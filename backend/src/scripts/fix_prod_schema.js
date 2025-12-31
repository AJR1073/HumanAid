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
        console.log('Starting Production Schema Fix...');

        // 1. Add primary_category_id to resources
        console.log('Checking resources.primary_category_id...');
        await client.query(`
            ALTER TABLE resources 
            ADD COLUMN IF NOT EXISTS primary_category_id INTEGER REFERENCES categories(id);
        `);

        // 2. Add food_dist_onsite to resources
        console.log('Checking resources.food_dist_onsite...');
        await client.query(`
            ALTER TABLE resources 
            ADD COLUMN IF NOT EXISTS food_dist_onsite BOOLEAN DEFAULT false;
        `);

        // 3. Add food_dist_type to resources
        console.log('Checking resources.food_dist_type...');
        await client.query(`
            ALTER TABLE resources 
            ADD COLUMN IF NOT EXISTS food_dist_type VARCHAR(20) CHECK (food_dist_type IN ('boxes', 'meal', 'both'));
        `);

        // 4. Ensure verified column exists
        console.log('Checking resources.verified...');
        await client.query(`
             ALTER TABLE resources
             ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;
        `);


        console.log('Production Schema Fix completed successfully.');
    } catch (error) {
        console.error('Schema Fix failed:', error);
    } finally {
        client.release();
        pool.end();
    }
}

migrate();
