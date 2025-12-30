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
const email = process.argv[2];

if (!email) {
    console.log('Usage: node promote_admin.js <email>');
    process.exit(1);
}

async function promoteUser() {
    const client = await pool.connect();
    try {
        console.log(`Promoting ${email} to Admin...`);
        const res = await client.query('UPDATE users SET is_admin = TRUE WHERE email = $1 RETURNING *', [email]);
        if (res.rowCount > 0) {
            console.log('Success! User is now an admin.');
        } else {
            console.log('User not found.');
        }
    } catch (error) {
        console.error('Error promoting user:', error);
    } finally {
        client.release();
        pool.end();
    }
}

promoteUser();
