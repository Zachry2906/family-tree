import express from "express";
import { fileURLToPath } from 'url';
import path from 'path';
import { 
    getFamily,
    createFamily,
    getRelationships,
    createRelationship,
    getFamilyById,
    updateFamily,
    deleteFamily,
    uploadPhoto   
} from "../controllers/FamillyController.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Routes  family
router.get("/family", getFamily);                  // Mendapatkan semua data keluarga
router.post("/family", createFamily);              // Membuat entri keluarga baru
router.get("/family/:id", getFamilyById);          // Mendapatkan data keluarga berdasarkan ID
router.put("/family/:id", updateFamily);           // Memperbarui data keluarga
router.delete("/family/:id", deleteFamily);        // Menghapus data keluarga

// Routes relationships
router.get("/relationships", getRelationships);    // Mendapatkan data relasi
router.post("/relationship", createRelationship);  // Membuat relasi baru

router.post("/upload-photo", uploadPhoto);         // Mengupload foto

// Route view
router.get('/view', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'view', 'index.html'));
});

export default router;