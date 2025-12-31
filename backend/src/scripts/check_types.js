const { Pool } = require('pg');

const pool = new Pool({
    host: '34.132.37.162',
    user: 'postgres',
    password: 'human_aid_2024',
    database: 'humanaid',
    ssl: { rejectUnauthorized: false }
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
