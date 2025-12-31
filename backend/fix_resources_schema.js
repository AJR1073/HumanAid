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
        console.log('Checking resources table...');

        // Check for hours
        const res = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='resources' AND column_name='hours'
    `);

        if (res.rows.length === 0) {
            console.log('Adding missing column: hours (TEXT)');
            await pool.query(`
        ALTER TABLE resources 
        ADD COLUMN hours TEXT
      `);
        } else {
            console.log('Column hours already exists.');
        }

        console.log('Schema fix completed successfully.');
    } catch (error) {
        console.error('Error fixing schema:', error);
    } finally {
        await pool.end();
    }
}

runFix();
