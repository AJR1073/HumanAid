const { Pool } = require('pg');
const path = require('path');
const dotenvPath = path.resolve(__dirname, '../../.env');
require('dotenv').config({ path: dotenvPath });

// Database connection
const dbConfig = process.env.INSTANCE_CONNECTION_NAME
    ? {
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'humanaid',
        host: `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000
    }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'humanaid',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000
    };

const pool = new Pool(dbConfig);

async function fixSchema() {
    const client = await pool.connect();
    try {
        console.log('Fixing resources table timestamp column...');
        await client.query('BEGIN');

        // Check if updated_at exists
        const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='resources' AND column_name='updated_at'
    `);

        if (res.rows.length === 0) {
            // Check if last_updated exists
            const res2 = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='resources' AND column_name='last_updated'
      `);

            if (res2.rows.length > 0) {
                console.log('Renaming last_updated to updated_at...');
                await client.query('ALTER TABLE resources RENAME COLUMN last_updated TO updated_at');
            } else {
                console.log('Adding updated_at column...');
                await client.query('ALTER TABLE resources ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
            }
        } else {
            console.log('updated_at column already exists.');
        }

        await client.query('COMMIT');
        console.log('Schema fix completed.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error fixing schema:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

fixSchema();
