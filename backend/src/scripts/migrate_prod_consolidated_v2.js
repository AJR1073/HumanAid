const { Pool } = require('pg');
require('dotenv').config();

// Production Config (Cloud SQL Socket or Public IP with whitelist)
// Assuming we run this locally connecting to Prod via Public IP (whitelisted)
const dbConfig = {
    host: '34.132.37.162',
    port: 5432,
    database: 'humanaid',
    user: 'postgres',
    password: process.env.DB_PASSWORD, // Ensure .env has prod password
    ssl: { rejectUnauthorized: false }
};

const pool = new Pool(dbConfig);

async function runMigration() {
    console.log('Starting Production Migration V2...');

    try {
        // 1. Fix pending_submissions schema
        console.log('Checking pending_submissions...');
        await pool.query(`
      CREATE TABLE IF NOT EXISTS pending_submissions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(500) NOT NULL,
        description TEXT,
        address VARCHAR(500),
        city VARCHAR(200),
        state VARCHAR(2),
        zip_code VARCHAR(10),
        phone VARCHAR(50),
        website VARCHAR(500),
        email VARCHAR(255),
        hours TEXT,
        primary_category_id INTEGER REFERENCES categories(id),
        tags JSONB,
        food_dist_onsite BOOLEAN DEFAULT false,
        food_dist_type VARCHAR(20),
        notes TEXT,
        submitted_by VARCHAR(255),
        submitted_by_name VARCHAR(255),
        submitted_by_uid VARCHAR(128),
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

        const submissionCols = [
            { name: 'primary_category_id', type: 'INTEGER REFERENCES categories(id)' },
            { name: 'tags', type: 'JSONB' },
            { name: 'food_dist_onsite', type: 'BOOLEAN DEFAULT false' },
            { name: 'food_dist_type', type: 'VARCHAR(20)' },
            { name: 'notes', type: 'TEXT' },
            { name: 'submitted_by', type: 'VARCHAR(255)' },
            { name: 'submitted_by_name', type: 'VARCHAR(255)' },
            { name: 'submitted_by_uid', type: 'VARCHAR(128)' },
            { name: 'hours', type: 'TEXT' }
        ];

        for (const col of submissionCols) {
            const res = await pool.query(`
          SELECT column_name FROM information_schema.columns 
          WHERE table_name='pending_submissions' AND column_name=$1
        `, [col.name]);

            if (res.rows.length === 0) {
                console.log(`Adding missing column to pending_submissions: ${col.name}`);
                try {
                    await pool.query(`ALTER TABLE pending_submissions ADD COLUMN ${col.name} ${col.type}`);
                } catch (e) { console.error(`Failed to add ${col.name}:`, e.message); }
            }
        }

        // 2. Fix resources schema (hours text column)
        console.log('Checking resources...');
        const resCols = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name='resources' AND column_name='hours'
    `);

        if (resCols.rows.length === 0) {
            console.log('Adding hours (TEXT) to resources...');
            await pool.query('ALTER TABLE resources ADD COLUMN hours TEXT');
        }

        // 3. Ensure PostGIS is ready (often is, but good to check if we use ST_SetSRID)
        // await pool.query('CREATE EXTENSION IF NOT EXISTS postgis');

        console.log('Migration V2 Completed Successfully.');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await pool.end();
    }
}

runMigration();
