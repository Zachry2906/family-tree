import Person from "../model/Person.js";
import Relationship from "../model/Relationship.js";
import Sequelize from "sequelize";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

// Setup direktori untuk menyimpan foto
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, '..', 'view', 'assets');

// Pastikan direktori upload ada
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

//multer untuk upload file
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function(req, file, cb) {
        // Generate nama file unik dengan timestamp
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'photo-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Limit 5MB
    fileFilter: function(req, file, cb) {
        // Hanya izinkan file gambar
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
}).single('photo');

export const uploadPhoto = (req, res) => {
    upload(req, res, function(err) {
        if (err) {
            console.error('Error uploading file:', err);
            return res.status(400).json({ error: err.message });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        res.json({
            message: 'File uploaded successfully',
            photoUrl: req.file.filename
        });
    });
};

// Improved family data retrieval to include spouse relationships
export const getFamily = async (req, res) => {
    const userId = req.id; // Ambil userId dari token yang sudah diverifikasi
    console.log("GetFamily - User ID from token:", userId);
    
    // Verify we have a valid userId
    if (!userId) {
        console.error("GetFamily - Missing userId in request");
        return res.status(401).json({ error: "Authentication required - userId not found" });
    }
    
    try {
        // First, get all persons with their basic information
        console.log("GetFamily - Fetching persons for userId:", userId);
        const persons = await Person.findAll({
            where: { name: userId },
            attributes: [
                'id', 'name', 'email', 'gender', 'born', 'photo', 'fid', 'mid', 'userId'
            ]
        });

        console.log(`GetFamily - Found ${persons.length} person records for userId: ${userId}`);
        
        // For debugging purposes, if zero records found, check if records exist for other userIds
        if (persons.length === 0) {
            const allUsers = await Person.findAll({
                attributes: ['userId'],
                group: ['userId']
            });
            console.log("Available userIds in database:", allUsers.map(u => u.userId));
        }

        // Then, get all spouse relationships for this user's persons only
        const personIds = persons.map(p => p.id);
        const allRelationships = await Relationship.findAll({
            where: { 
                relationship_type: 'spouse',
                person_id: personIds  // Only get relationships for this user's persons
            }
        });

        // Create a map of person_id to array of spouse IDs
        const spouseMap = {};
        allRelationships.forEach(rel => {
            if (!spouseMap[rel.person_id]) {
                spouseMap[rel.person_id] = [];
            }
            spouseMap[rel.person_id].push(rel.related_person_id);
        });

        // Map persons to include their spouse IDs
        const familyData = persons.map(person => {
            const personObj = person.toJSON();
            return {
                ...personObj,
                pids: spouseMap[person.id] || []
            };
        });

        console.log(`GetFamily - Returning ${familyData.length} family members for userId: ${userId}`);
        res.json(familyData);
    } catch (error) {
        console.error('Error in getFamily:', error);
        res.status(500).json({ error: error.message });
    }
};

export const createFamily = async (req, res) => {
    const transaction = await Person.sequelize.transaction();
    const userId = req.id; // Ambil userId dari token yang sudah diverifikasi
    try {
        let { id, name, email, gender, born, photo, fid, mid, pids } = req.body;

        // Process the incoming fields
        fid = fid && fid !== "null" ? fid : null;
        mid = mid && mid !== "null" ? mid : null;

        // Create the person record
        const person = await Person.create({
            name,
            email,
            gender,
            born,
            photo,
            fid,
            mid,
            userId
        }, { transaction });

        // Handle spouse relationships if provided
        if (pids && Array.isArray(pids) && pids.length > 0) {
            // Create relationships for all spouses
            for (const spouseId of pids) {
                // Check if spouse exists
                const spouse = await Person.findByPk(spouseId, { transaction });

                if (spouse) {
                    // Create bidirectional spouse relationship
                    await Relationship.create({
                        person_id: person.id,
                        related_person_id: spouseId,
                        relationship_type: 'spouse'
                    }, { transaction });

                    await Relationship.create({
                        person_id: spouseId,
                        related_person_id: person.id,
                        relationship_type: 'spouse'
                    }, { transaction });
                }
            }
        }

        await transaction.commit();

        const response = {
            message: "Person added successfully",
            data: {
                id: person.id,
                name,
                email,
                gender,
                born,
                photo,
                fid,
                mid,
                pids: pids || [],
                userId
            }
        };

        res.status(201).json(response);
    } catch (error) {
        await transaction.rollback();
        console.error('Error in createFamily:', error);
        res.status(500).json({ error: error.message });
    }
};

export const getRelationships = async (req, res) => {
    try {
        const { person_id, related_person_id } = req.query;

        const whereClause = {};
        if (person_id) whereClause.person_id = person_id;
        if (related_person_id) whereClause.related_person_id = related_person_id;

        const relationships = await Relationship.findAll({ where: whereClause });

        res.json(relationships);
    } catch (error) {
        console.error('Error in getRelationships:', error);
        res.status(500).json({ error: error.message });
    }
};

export const createRelationship = async (req, res) => {
    const transaction = await Relationship.sequelize.transaction();

    try {
        const { person_id, related_person_id, relationship_type } = req.body;

        // Check if relationship already exists to avoid duplicates
        const existingRelationship = await Relationship.findOne({
            where: {
                person_id,
                related_person_id,
                relationship_type
            }
        }, { transaction });

        if (existingRelationship) {
            await transaction.commit();
            return res.status(200).json({
                message: "Relationship already exists",
                data: { id: existingRelationship.id }
            });
        }

        // Create new relationship
        const relationship = await Relationship.create({
            person_id,
            related_person_id,
            relationship_type
        }, { transaction });

        // Add reverse relationship if spouse
        if (relationship_type === 'spouse') {
            // Check if reverse relationship exists
            const existingReverseRelationship = await Relationship.findOne({
                where: {
                    person_id: related_person_id,
                    related_person_id: person_id,
                    relationship_type
                }
            }, { transaction });

            if (!existingReverseRelationship) {
                await Relationship.create({
                    person_id: related_person_id,
                    related_person_id: person_id,
                    relationship_type
                }, { transaction });
            }
        }

        await transaction.commit();

        const response = {
            message: "Relationship added successfully",
            data: { id: relationship.id }
        };

        res.status(201).json(response);
    } catch (error) {
        await transaction.rollback();
        console.error('Error in createRelationship:', error);
        res.status(500).json({ error: error.message });
    }
};

export const getFamilyById = async (req, res) => {
    try {
        const personId = req.params.id;
        const person = await Person.findByPk(personId);

        if (!person) {
            return res.status(404).json({ error: "Person not found" });
        }

        // Get spouse relationships
        const spouseRelationships = await Relationship.findAll({
            where: {
                person_id: personId,
                relationship_type: 'spouse'
            }
        });

        const spouseIds = spouseRelationships.map(rel => rel.related_person_id);

        // Convert to response format
        const personData = {
            ...person.toJSON(),
            pids: spouseIds
        };

        res.json(personData);
    } catch (error) {
        console.error('Error in getFamilyById:', error);
        res.status(500).json({ error: error.message });
    }
};

export const updateFamily = async (req, res) => {
    const transaction = await Person.sequelize.transaction();
    const userId = req.id; // Ambil userId dari token yang sudah diverifikasi

    try {
        const personId = req.params.id;
        const { name, email, gender, born, photo, fid, mid, pids } = req.body;

        const person = await Person.findByPk(personId, { transaction });
        if (!person) {
            await transaction.rollback();
            return res.status(404).json({ error: "Person not found" });
        }

        // Process parent IDs
        let validFid = fid && fid !== "null" ? fid : null;
        let validMid = mid && mid !== "null" ? mid : null;

        // Handle father relationship if provided
        if (validFid) {
            const father = await Person.findByPk(validFid, { transaction });
            if (!father) {
                const newFather = await Person.create({
                    name: "Unknown Father",
                    gender: "male",
                    born: null,
                    photo: null,
                    userId : userId
                }, { transaction });
                validFid = newFather.id;
            }
        }

        // Handle mother relationship if provided
        if (validMid) {
            const mother = await Person.findByPk(validMid, { transaction });
            if (!mother) {
                const newMother = await Person.create({
                    name: "Unknown Mother",
                    gender: "female",
                    born: null,
                    photo: null,
                    userId : userId
                }, { transaction });
                validMid = newMother.id;
            }
        }

        // Create parent relationship if both parents exist
        if (validFid && validMid) {
            // Check if relationship already exists
            const existingRelationship = await Relationship.findOne({
                where: {
                    person_id: validFid,
                    related_person_id: validMid,
                    relationship_type: 'spouse'
                },
                transaction
            });

            if (!existingRelationship) {
                // Create bidirectional spouse relationship between parents
                await Relationship.create({
                    person_id: validFid,
                    related_person_id: validMid,
                    relationship_type: 'spouse'
                }, { transaction });

                await Relationship.create({
                    person_id: validMid,
                    related_person_id: validFid,
                    relationship_type: 'spouse'
                }, { transaction });
            }
        }

        // Process photo
        const updatedPhoto = photo && !photo.startsWith("assets/")
            ? `assets/${photo}`
            : photo;

        // Delete old photo if changed
        if (person.photo && person.photo !== updatedPhoto) {
            const oldPhotoPath = path.join(uploadDir, path.basename(person.photo));
            if (fs.existsSync(oldPhotoPath)) {
                fs.unlinkSync(oldPhotoPath);
            }
        }

        // Update person record
        await person.update({
            name,
            gender,
            email,
            born,
            photo: updatedPhoto,
            fid: validFid,
            mid: validMid,
            userId : userId
        }, { transaction });

        // Handle spouse relationships if provided
        if (pids && Array.isArray(pids)) {
            // Get current spouse relationships
            const currentSpouseRelationships = await Relationship.findAll({
                where: {
                    person_id: personId,
                    relationship_type: 'spouse'
                },
                transaction
            });

            const currentSpouseIds = currentSpouseRelationships.map(rel => rel.related_person_id);

            // Remove relationships that no longer exist
            for (const currentSpouseId of currentSpouseIds) {
                if (!pids.includes(currentSpouseId)) {
                    await Relationship.destroy({
                        where: {
                            person_id: personId,
                            related_person_id: currentSpouseId,
                            relationship_type: 'spouse'
                        },
                        transaction
                    });

                    await Relationship.destroy({
                        where: {
                            person_id: currentSpouseId,
                            related_person_id: personId,
                            relationship_type: 'spouse'
                        },
                        transaction
                    });
                }
            }

            // Add new relationships
            for (const spouseId of pids) {
                if (!currentSpouseIds.includes(spouseId)) {
                    // Create bidirectional relationship
                    await Relationship.create({
                        person_id: personId,
                        related_person_id: spouseId,
                        relationship_type: 'spouse'
                    }, { transaction });

                    await Relationship.create({
                        person_id: spouseId,
                        related_person_id: personId,
                        relationship_type: 'spouse'
                    }, { transaction });
                }
            }
        }

        await transaction.commit();

        res.json({
            message: "Family member updated successfully",
            data: {
                id: personId,
                name,
                gender,
                email,
                born,
                photo: updatedPhoto,
                fid: validFid,
                mid: validMid,
                pids: pids || [],
                userId
            }
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error in updateFamily:', error);
        res.status(500).json({ error: error.message });
    }
};

export const deleteFamily = async (req, res) => {
    const transaction = await Person.sequelize.transaction();

    try {
        const personId = req.params.id;
        const personToDelete = await Person.findByPk(personId, { transaction });

        if (!personToDelete) {
            await transaction.rollback();
            return res.status(404).json({ error: "Person not found" });
        }

        // Delete photo if exists
        if (personToDelete.photo) {
            const photoPath = path.join(uploadDir, path.basename(personToDelete.photo));
            if (fs.existsSync(photoPath)) {
                fs.unlinkSync(photoPath);
            }
        }

        // Delete all relationships
        await Relationship.destroy({
            where: {
                [Sequelize.Op.or]: [
                    { person_id: personId },
                    { related_person_id: personId }
                ]
            },
            transaction
        });

        // Update children that have this person as father
        await Person.update(
            { fid: null },
            {
                where: { fid: personId },
                transaction
            }
        );

        // Update children that have this person as mother
        await Person.update(
            { mid: null },
            {
                where: { mid: personId },
                transaction
            }
        );

        // Delete the person
        await personToDelete.destroy({ transaction });

        await transaction.commit();

        res.json({
            message: "Person and all related references deleted successfully",
            id: personId
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error in deleteFamily:', error);
        res.status(500).json({ error: error.message });
    }
};