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

async function check_categories() {
    const client = await pool.connect();
    try {
        console.log('Checking Category Data...');

        // 1. List all categories with IDs and Slugs
        const cats = await client.query('SELECT id, name, slug FROM categories ORDER BY id');
        console.log('Categories Table:', cats.rows);

        // 2. Sample resources to see what primary_category_id they have
        const resSample = await client.query('SELECT id, name, primary_category_id FROM resources WHERE primary_category_id IS NOT NULL LIMIT 10');
        console.log('Sample Resources:', resSample.rows);

        // 3. Count resources per category
        const counts = await client.query(`
            SELECT c.name, c.slug, count(r.id) as resource_count
            FROM categories c
            LEFT JOIN resources r ON c.id = r.primary_category_id
            GROUP BY c.name, c.slug
            ORDER BY resource_count DESC
        `);
        console.log('Resources per Category:', counts.rows);

    } catch (error) {
        console.error('Check failed:', error);
    } finally {
        client.release();
        pool.end();
    }
}

check_categories();
