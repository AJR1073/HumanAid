const { Pool } = require('pg');
const path = require('path');
const dotenvPath = path.resolve(__dirname, '../../.env');
require('dotenv').config({ path: dotenvPath });

// Production config via Cloud SQL Socket or TCP/IP
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
        ssl: process.env.DB_HOST !== 'localhost' ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000
    };

const pool = new Pool(dbConfig);

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('Starting Production Schema Fix V2 (Tags)...');

        // 1. Create tags table
        console.log('Checking tags table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS tags (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                slug VARCHAR(255) NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 2. Create resource_tags table
        console.log('Checking resource_tags table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS resource_tags (
                resource_id INTEGER REFERENCES resources(id) ON DELETE CASCADE,
                tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
                PRIMARY KEY (resource_id, tag_id)
            );
        `);

        // 3. Create indexes for tags
        console.log('Creating indexes...');
        await client.query(`
           -- Resource tags indexes (if they don't exist, this might fail differently so we wrap in block or ignore error, 
           -- but simple create index if not exists is pg 9.5+)
           
           -- Check if index exists function (simple workaround)
           DO $$
           BEGIN
               IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_resource_tags_resource') THEN
                   CREATE INDEX idx_resource_tags_resource ON resource_tags(resource_id);
               END IF;
               
               IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_resource_tags_tag') THEN
                   CREATE INDEX idx_resource_tags_tag ON resource_tags(tag_id);
               END IF;
           END $$;
        `);

        console.log('Production Schema Fix V2 completed successfully.');
    } catch (error) {
        console.error('Schema Fix V2 failed:', error);
    } finally {
        client.release();
        pool.end();
    }
}

migrate();
