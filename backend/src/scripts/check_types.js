const { Pool } = require('pg');

for (const key of ['DB_HOST', 'DB_USER', 'DB_NAME', 'DB_PASSWORD']) {
    if (!process.env[key]) throw new Error(`${key} must be supplied through a secure environment.`);
}

const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined
});

async function checkTypes() {
    try {
        const res = await pool.query('SELECT id FROM resources LIMIT 1');
        if (res.rows.length > 0) {
            console.log('ID value:', res.rows[0].id);
            console.log('ID type:', typeof res.rows[0].id);
        } else {
            console.log('No resources found');
        }
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

checkTypes();
