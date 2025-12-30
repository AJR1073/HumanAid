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

async function updateSchema() {
    const client = await pool.connect();
    try {
        console.log('Updating pending_submissions schema...');
        await client.query('BEGIN');

        // Check if table exists
        const res = await client.query(`
      SELECT 1 FROM information_schema.tables WHERE table_name='pending_submissions'
    `);

        if (res.rows.length === 0) {
            console.log('pending_submissions table does not exist. Creating it (basic version + new fields)...');
            await client.query(`
        CREATE TABLE pending_submissions (
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
            hours JSONB,
            primary_category_id INTEGER REFERENCES categories(id),
            tags JSONB,
            food_dist_onsite BOOLEAN DEFAULT false,
            food_dist_type VARCHAR(20),
            notes TEXT,
            submitted_by VARCHAR(255),
            submitted_by_name VARCHAR(255),
            submitted_by_uid VARCHAR(128),
            status VARCHAR(20) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            reviewed_at TIMESTAMP,
            reviewed_by VARCHAR(255)
        );
      `);
        } else {
            // Table exists, check for category_id vs primary_category_id
            const colRes = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name='pending_submissions' AND column_name='category_id'
        `);

            if (colRes.rows.length > 0) {
                console.log('Renaming category_id to primary_category_id...');
                await client.query('ALTER TABLE pending_submissions RENAME COLUMN category_id TO primary_category_id');
            }

            // Add other columns if missing
            console.log('Adding new columns if missing...');
            await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pending_submissions' AND column_name='primary_category_id') THEN
                    ALTER TABLE pending_submissions ADD COLUMN primary_category_id INTEGER REFERENCES categories(id);
                END IF;

                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pending_submissions' AND column_name='tags') THEN
                    ALTER TABLE pending_submissions ADD COLUMN tags JSONB;
                END IF;

                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pending_submissions' AND column_name='food_dist_onsite') THEN
                    ALTER TABLE pending_submissions ADD COLUMN food_dist_onsite BOOLEAN DEFAULT false;
                END IF;

                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pending_submissions' AND column_name='food_dist_type') THEN
                    ALTER TABLE pending_submissions ADD COLUMN food_dist_type VARCHAR(20);
                END IF;
            END $$;
        `);
        }

        await client.query('COMMIT');
        console.log('pending_submissions schema updated.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating schema:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

updateSchema();
