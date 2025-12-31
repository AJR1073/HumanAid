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

async function check() {
    const client = await pool.connect();
    try {
        console.log('Checking Data...');

        const resResources = await client.query('SELECT COUNT(*) as count, COUNT(primary_category_id) as filled FROM resources');
        console.log('Resources:', resResources.rows[0]);

        const resJoin = await client.query('SELECT COUNT(*) as count FROM resource_categories');
        console.log('Resource Categories Join Table:', resJoin.rows[0]);

        const sampleJoin = await client.query('SELECT * FROM resource_categories LIMIT 5');
        console.log('Sample Join Data:', sampleJoin.rows);

    } catch (error) {
        console.error('Check failed:', error);
    } finally {
        client.release();
        pool.end();
    }
}

check();
