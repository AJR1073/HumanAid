const { Pool } = require('pg');
require('dotenv').config();

const dbConfig = {
    host: '34.132.37.162',
    port: 5432,
    database: 'humanaid',
    user: 'postgres',
    password: process.env.DB_PASSWORD || 'new_password123!',
    ssl: { rejectUnauthorized: false }
};

const pool = new Pool(dbConfig);

async function checkZips() {
    try {
        console.log('--- ZIP Code Diagnosis ---');

        // 1. Count resources
        const count = await pool.query('SELECT COUNT(*) FROM resources');
        console.log(`Total Resources: ${count.rows[0].count}`);

        // 2. Count with missing zip
        const missing = await pool.query("SELECT COUNT(*) FROM resources WHERE zip_code IS NULL OR zip_code = ''");
        console.log(`Resources with Missing/Empty ZIP: ${missing.rows[0].count}`);

        // 3. Search for 62298 exactly
        const exact = await pool.query("SELECT id, name, city, zip_code FROM resources WHERE zip_code = '62298'");
        console.log(`Exact match for '62298': ${exact.rows.length}`);
        if (exact.rows.length > 0) console.log(exact.rows);

        // 4. Search for nearby zips or partial matches
        const partial = await pool.query("SELECT id, name, city, zip_code FROM resources WHERE zip_code ILIKE '%62298%'");
        console.log(`Partial match for '%62298%': ${partial.rows.length}`);

        // 5. Look for resources in Alton or nearby cities without Zip
        const missingZipExamples = await pool.query("SELECT id, name, city, address FROM resources WHERE (zip_code IS NULL OR zip_code = '') LIMIT 5");
        console.log('Examples of missing ZIPs:', missingZipExamples.rows);

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

checkZips();
