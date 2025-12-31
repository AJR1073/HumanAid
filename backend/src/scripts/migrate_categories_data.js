const { Pool } = require('pg');
const path = require('path');
const dotenvPath = path.resolve(__dirname, '../../.env');
require('dotenv').config({ path: dotenvPath });

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

async function migrate_data() {
    const client = await pool.connect();
    try {
        console.log('Starting Primary Category Backfill...');

        const updateQuery = `
            UPDATE resources r
            SET primary_category_id = rc.category_id
            FROM resource_categories rc
            WHERE r.id = rc.resource_id
            AND r.primary_category_id IS NULL;
        `;

        const res = await client.query(updateQuery);
        console.log(`Updated ${res.rowCount} resources with primary_category_id.`);

        console.log('Backfill completed successfully.');
    } catch (error) {
        console.error('Backfill failed:', error);
    } finally {
        client.release();
        pool.end();
    }
}

migrate_data();
