require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('@neondatabase/serverless');
const path = require('path');

const app = express();
app.use(cors());
// Aumentar el límite de JSON en caso de que suban archivos muy grandes
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '..')));

// Conexión a Neon mediante variable de entorno (.env / Vercel Environment Variables)
if (!process.env.DATABASE_URL) {
    console.warn('ADVERTENCIA: DATABASE_URL no está configurada en las variables de entorno.');
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

let dbInitPromise = null;
function initDB() {
    if (!dbInitPromise) {
        dbInitPromise = (async () => {
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
                dbInitPromise = null;
            }
        })();
    }
    return dbInitPromise;
}
initDB();

// RUTAS API

// 1. Obtener resumen ligero de materias (sin descargar todo el JSONB de preguntas)
app.get('/api/subjects', async (req, res) => {
    try {
        await initDB();
        // Si piden explícitamente full=1, devolvemos con data (compatibilidad)
        if (req.query.full === '1') {
            const subjectsResult = await pool.query('SELECT * FROM subjects ORDER BY created_at DESC');
            const filesResult = await pool.query('SELECT id, subject_id, name, created_at, data FROM files ORDER BY created_at DESC');

            const subjects = subjectsResult.rows.map(sub => ({
                id: sub.id,
                name: sub.name,
                files: filesResult.rows
                    .filter(f => f.subject_id === sub.id)
                    .map(f => ({
                        id: f.id,
                        name: f.name,
                        date: f.created_at,
                        questionCount: Array.isArray(f.data) ? f.data.length : 0,
                        data: f.data
                    }))
            }));
            return res.json(subjects);
        }

        // Consulta ligera: solo metadatos y conteo de preguntas por archivo
        const subjectsResult = await pool.query('SELECT id, name, created_at FROM subjects ORDER BY created_at DESC');
        const filesMetaResult = await pool.query(`
            SELECT
                id,
                subject_id,
                name,
                created_at,
                CASE WHEN jsonb_typeof(data) = 'array' THEN jsonb_array_length(data) ELSE 0 END AS question_count
            FROM files
            ORDER BY created_at DESC
        `);

        const filesBySubject = new Map();
        for (const f of filesMetaResult.rows) {
            if (!filesBySubject.has(f.subject_id)) {
                filesBySubject.set(f.subject_id, []);
            }
            filesBySubject.get(f.subject_id).push({
                id: f.id,
                name: f.name,
                date: f.created_at,
                questionCount: Number(f.question_count) || 0
            });
        }

        const subjects = subjectsResult.rows.map(sub => {
            const subFiles = filesBySubject.get(sub.id) || [];
            const questionCount = subFiles.reduce((acc, f) => acc + f.questionCount, 0);
            return {
                id: sub.id,
                name: sub.name,
                createdAt: sub.created_at,
                fileCount: subFiles.length,
                questionCount,
                files: subFiles
            };
        });

        res.json(subjects);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Obtener detalle ligero de una sola materia y sus archivos (sin el JSONB pesado)
app.get('/api/subjects/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await initDB();
        const subjectResult = await pool.query('SELECT id, name, created_at FROM subjects WHERE id = $1', [id]);
        if (subjectResult.rows.length === 0) {
            return res.status(404).json({ error: 'Materia no encontrada' });
        }

        const filesResult = await pool.query(`
            SELECT
                id,
                name,
                created_at,
                CASE WHEN jsonb_typeof(data) = 'array' THEN jsonb_array_length(data) ELSE 0 END AS question_count
            FROM files
            WHERE subject_id = $1
            ORDER BY created_at DESC
        `, [id]);

        const sub = subjectResult.rows[0];
        const files = filesResult.rows.map(f => ({
            id: f.id,
            name: f.name,
            date: f.created_at,
            questionCount: Number(f.question_count) || 0
        }));

        res.json({
            id: sub.id,
            name: sub.name,
            createdAt: sub.created_at,
            fileCount: files.length,
            questionCount: files.reduce((acc, f) => acc + f.questionCount, 0),
            files
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Obtener las preguntas únicamente de los archivos seleccionados para el quiz
app.get('/api/subjects/:id/questions', async (req, res) => {
    const { id } = req.params;
    const filesParam = req.query.files;
    try {
        await initDB();
        const subjectResult = await pool.query('SELECT id, name FROM subjects WHERE id = $1', [id]);
        if (subjectResult.rows.length === 0) {
            return res.status(404).json({ error: 'Materia no encontrada' });
        }

        let filesResult;
        if (filesParam) {
            const fileIds = String(filesParam)
                .split(',')
                .map(s => s.trim())
                .filter(Boolean);

            if (fileIds.length === 0) {
                return res.json({ subject: subjectResult.rows[0], files: [] });
            }

            filesResult = await pool.query(
                'SELECT id, name, data FROM files WHERE subject_id = $1 AND id = ANY($2::uuid[])',
                [id, fileIds]
            );
        } else {
            filesResult = await pool.query(
                'SELECT id, name, data FROM files WHERE subject_id = $1 ORDER BY created_at DESC',
                [id]
            );
        }

        res.json({
            subject: subjectResult.rows[0],
            files: filesResult.rows.map(f => ({
                id: f.id,
                name: f.name,
                data: Array.isArray(f.data) ? f.data : []
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Crear materia
app.post('/api/subjects', async (req, res) => {
    const { id, name } = req.body;
    try {
        await initDB();
        await pool.query('INSERT INTO subjects (id, name) VALUES ($1, $2)', [id, name]);
        res.json({ success: true, id, name });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Eliminar materia
app.delete('/api/subjects/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await initDB();
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
        await initDB();
        await pool.query(
            'INSERT INTO files (id, subject_id, name, data) VALUES ($1, $2, $3, $4)',
            [id, subject_id, name, JSON.stringify(data)]
        );
        res.json({
            success: true,
            file: {
                id,
                name,
                questionCount: Array.isArray(data) ? data.length : 0
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Eliminar archivo
app.delete('/api/files/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await initDB();
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
