const { Pool } = require('pg');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'humanaid',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_HOST !== 'localhost' ? { rejectUnauthorized: false } : false
};

const pool = new Pool(dbConfig);

async function runFix() {
    try {
        console.log('Checking pending_submissions table...');

        // Create table if not exists (covering all fields from server.js)
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
        -- primary_category_id added below if missing
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
        console.log('Table structure ensured.');

        // Check for primary_category_id
        const res = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='pending_submissions' AND column_name='primary_category_id'
    `);

        if (res.rows.length === 0) {
            console.log('Adding missing column: primary_category_id');
            await pool.query(`
        ALTER TABLE pending_submissions 
        ADD COLUMN primary_category_id INTEGER REFERENCES categories(id)
      `);
        } else {
            console.log('Column primary_category_id already exists.');
        }

        console.log('Schema fix completed successfully.');
    } catch (error) {
        console.error('Error fixing schema:', error);
    } finally {
        await pool.end();
    }
}

runFix();
