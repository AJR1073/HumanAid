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

async function checkResources() {
    try {
        console.log('Fetching last 5 resources...');

        const res = await pool.query(`
      SELECT id, name, slug, city, hours, is_active, location, created_at 
      FROM resources 
      ORDER BY created_at DESC 
      LIMIT 5
    `);

        if (res.rows.length === 0) {
            console.log('No resources found.');
        } else {
            console.table(res.rows);
        }
    } catch (error) {
        console.error('Error fetching resources:', error);
    } finally {
        await pool.end();
    }
}

checkResources();
