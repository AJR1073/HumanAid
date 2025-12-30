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
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000
    };

const pool = new Pool(dbConfig);
const email = 'aaronreifschneider@outlook.com';
const name = 'AARON REIFSCHNEIDER';
// Using a placeholder UID since we don't know the real Firebase UID yet. 
// This might cause a duplicate if the real sync ever works, but it unblocks the admin feature.
const uid = 'manual_admin_' + Date.now();

async function insertAdmin() {
    const client = await pool.connect();
    try {
        console.log(`Inserting/Updating ${email}...`);

        // Check if exists by email to get real UID if possible (though unlikely if list was empty)
        // Actually, list_users showed it wasn't there.

        await client.query(`
      INSERT INTO users (firebase_uid, email, display_name, is_admin, last_login)
      VALUES ($1, $2, $3, TRUE, NOW())
      ON CONFLICT (firebase_uid) DO NOTHING;
    `, [uid, email, name]);

        // Also update by email just in case
        await client.query(`UPDATE users SET is_admin = TRUE WHERE email = $1`, [email]);

        console.log('User manually inserted as Admin.');
    } catch (error) {
        console.error('Error inserting admin:', error);
    } finally {
        client.release();
        pool.end();
    }
}

insertAdmin();
