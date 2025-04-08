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


export const getFamily = async (req, res) => {
    try {
        const persons = await Person.findAll({
            include: [{
                model: Relationship,
                as: 'relationships', // alias harus sesuai dengan asosiasi
                where: { relationship_type: 'spouse' },
                required: false
            }],
            // disesuaikan dengan kolom yang ada di tabel person
            attributes: [
                'id', 'name', 'email', 'gender', 'born', 'photo', 'fid', 'mid'
            ]
        });

        const familyData = persons.map(person => ({
            id: person.id,
            name: person.name,
            email: person.email,
            gender: person.gender,
            born: person.born,
            photo: person.photo,
            pids: person.relationships ? person.relationships.map(s => s.related_person_id) : [],
            fid: person.fid,
            mid: person.mid
        }));

        res.json(familyData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const createFamily = async (req, res) => {
    try {
        let { name, email, gender, born, photo, fid, mid } = req.body;

        // cek jika fid ada dan bukan null
        // jika ada, cari orang tua di database
        fid = fid && fid !== "null" ? fid : null;
        mid = mid && mid !== "null" ? mid : null;

        const person = await Person.create({
            name, email, gender, born, photo, fid, mid
        });

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
                mid
            }
        };
        res.status(201).json(response);
    } catch (error) {
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
        res.status(500).json({ error: error.message });
    }
};

export const createRelationship = async (req, res) => {
    try {
        const { person_id, related_person_id, relationship_type } = req.body;

        // buat relasi baru di tabel asosiasi
        const relationship = await Relationship.create({
            person_id,
            related_person_id,
            relationship_type
        });

        // tambahkan relasi terbalik jika relationship_type adalah 'spouse'
        if (relationship_type === 'spouse') {
            await Relationship.create({
                person_id: related_person_id,
                related_person_id: person_id,
                relationship_type
            });
        }

        const response = {
            message: "Relationship added successfully",
            data: { id: relationship.id }
        };
        res.status(201).json(response);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getFamilyById = async (req, res) => {
    try {
        const person = await Person.findByPk(req.params.id);
        
        if (!person) {
            return res.status(404).json({ error: "Person not found" });
        }
        
        res.json(person);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const updateFamily = async (req, res) => {
    try {
        const { name, email, gender, born, photo, fid, mid } = req.body;
        
        const person = await Person.findByPk(req.params.id);
        if (!person) {
            return res.status(404).json({ error: "Person not found" });
        }

        let validFid = fid && fid !== "null" ? fid : null;
        let validMid = mid && mid !== "null" ? mid : null;

        // Transaksi untuk memastikan data konsisten
        await Person.sequelize.transaction(async (t) => {
            if (validFid) {
                const father = await Person.findByPk(validFid, { transaction: t });
                // cek jika ayah ada di database
                // jika tidak ada, buat node baru ayah di db
                if (!father) {
                    const newFather = await Person.create({
                        name: "Unknown Father",
                        gender: "male",
                        born: null,
                        photo: null
                    }, { transaction: t });
                    validFid = newFather.id;
                    // ambil id ayah yang baru dibuat
                    // hapus id ayah yang lama, karena waktu buat di fe langsung buat 2 node
                    const deletePrevieousId = await Person.findByPk(validFid - 1, { transaction: t });
                    await deletePrevieousId.destroy();
                }
            }

            // sama seperti di atas, hanya saja ini untuk ibu
            if (validMid) {
                const mother = await Person.findByPk(validMid, { transaction: t });
                if (!mother) {
                    const newMother = await Person.create({
                        name: "Unknown Mother",
                        gender: "female",
                        born: null,
                        photo: null
                    }, { transaction: t });
                    validMid = newMother.id;

                    const deletePrevieousId = await Person.findByPk(validMid - 1, { transaction: t });
                    await deletePrevieousId.destroy();
                }
            }

            if (validFid && validMid) {
                // Cek apakah relasi sudah ada di tabel Relationship
                if (!await Relationship.findOne({
                    where: {
                        person_id: validFid,
                        related_person_id: validMid,
                        relationship_type: 'spouse'
                    },
                    transaction: t
                })) {
                    // Jika tidak ada, buat relasi baru
                    await Relationship.create({
                        person_id: validMid,
                        related_person_id: validFid,
                        relationship_type: 'spouse'
                    }, { transaction: t });

                    // Buat relasi terbalik
                    await Relationship.create({
                        person_id: validFid,
                        related_person_id: validMid,
                        relationship_type: 'spouse'
                    }, { transaction: t });
                }
            }

            // simpan foto di folder assets
            // jika foto ada dan belum diawali "assets/"
            const updatedPhoto = photo && !photo.startsWith("assets/") 
                ? `assets/${photo}` 
                : photo;

            // cek jika foto ada dan foto yang diupload berbeda dengan foto yang ada di database
            // jika kondisi ini terpenuhi, hapus foto lama
            if (person.photo && person.photo !== updatedPhoto) {
                const oldPhotoPath = path.join(uploadDir, path.basename(person.photo)); // ambil nama file dari path
                if (fs.existsSync(oldPhotoPath)) {
                    fs.unlinkSync(oldPhotoPath);
                }
            }

            await person.update({
                name,
                gender,
                email,
                born,
                photo: updatedPhoto,
                fid: validFid,
                mid: validMid
            }, { transaction: t });
        });

        res.json({ 
            message: "Family member updated successfully", 
            fid: validFid, 
            mid: validMid 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const deleteFamily = async (req, res) => {
    try {
        const personId = req.params.id;
        const personToDelete = await Person.findByPk(personId);
        
        if (!personToDelete) {
            return res.status(404).json({ error: "Person not found" });
        }
        
        // menghapus relasi di tabel Relationship
        await Relationship.destroy({
            where: {
                [Sequelize.Op.or]: [
                    { person_id: personId },
                    { related_person_id: personId }
                ]
            }
        });
        
        // update anak-anak yang memiliki orang ini sebagai ayah (fid)
        await Person.update(
            { fid: null },
            { where: { fid: personId } }
        );
        
        // U=update anak-anak yang memiliki orang ini sebagai ibu (mid)
        await Person.update(
            { mid: null },
            { where: { mid: personId } }
        );
        
        // H=hapus orang tersebut
        await personToDelete.destroy();
        
        res.json({ message: "Person and all related references deleted successfully" });
    } catch (error) {
        console.error('Error in deleteFamily:', error);
        res.status(500).json({ error: error.message });
    }
};