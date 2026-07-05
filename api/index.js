const express = require('express');
const cors = require('cors');
const { Pool } = require('@neondatabase/serverless');
const path = require('path');

const app = express();
app.use(cors());
// Aumentar el límite de JSON en caso de que suban archivos muy grandes
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '..')));

// Conexión a Neon
const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_8txuJf3HwlOI@ep-misty-pond-ampl4jqm-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require',
});

async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS subjects (
                id UUID PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS files (
                id UUID PRIMARY KEY,
                subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                data JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Base de datos inicializada');
    } catch (error) {
        console.error('Error inicializando BD:', error);
    }
}
initDB();

// RUTAS API

// Obtener todas las materias y sus archivos
app.get('/api/subjects', async (req, res) => {
    try {
        const subjectsResult = await pool.query('SELECT * FROM subjects ORDER BY created_at DESC');
        const filesResult = await pool.query('SELECT id, subject_id, name, created_at, data FROM files');
        
        const subjects = subjectsResult.rows.map(sub => {
            return {
                id: sub.id,
                name: sub.name,
                files: filesResult.rows.filter(f => f.subject_id === sub.id).map(f => ({
                    id: f.id,
                    name: f.name,
                    date: f.created_at,
                    data: f.data
                }))
            };
        });
        
        res.json(subjects);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Crear materia
app.post('/api/subjects', async (req, res) => {
    const { id, name } = req.body;
    try {
        await pool.query('INSERT INTO subjects (id, name) VALUES ($1, $2)', [id, name]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Eliminar materia
app.delete('/api/subjects/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // ON DELETE CASCADE se encarga de eliminar los archivos asociados
        await pool.query('DELETE FROM subjects WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Subir archivo a una materia
app.post('/api/subjects/:id/files', async (req, res) => {
    const { id: subject_id } = req.params;
    const { id, name, data } = req.body;
    try {
        await pool.query('INSERT INTO files (id, subject_id, name, data) VALUES ($1, $2, $3, $4)', [id, subject_id, name, JSON.stringify(data)]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Eliminar archivo
app.delete('/api/files/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM files WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
}
module.exports = app;
