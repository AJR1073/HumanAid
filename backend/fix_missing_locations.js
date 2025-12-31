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

async function fixLocations() {
    try {
        console.log('Fixing missing locations for Alton area resources...');

        // Default Alton, IL coordinates: -90.1843, 38.8906
        // Using simple spread to avoid stacking them exactly on top of each other if possible, 
        // but for now just same point is fine to verify visibility.

        // Update IDs 8419, 8420, 8421
        const ids = [8419, 8420, 8421];

        for (const id of ids) {
            // Slightly jitters to separate markers
            const lng = -90.1843 + (Math.random() * 0.01 - 0.005);
            const lat = 38.8906 + (Math.random() * 0.01 - 0.005);

            await pool.query(`
         UPDATE resources 
         SET location = ST_SetSRID(ST_MakePoint($1, $2), 4326)
         WHERE id = $3
       `, [lng, lat, id]);

            console.log(`Updated resource ${id} with location ${lng}, ${lat}`);
        }

        console.log('Location fix completed.');
    } catch (error) {
        console.error('Error fixing locations:', error);
    } finally {
        await pool.end();
    }
}

fixLocations();
