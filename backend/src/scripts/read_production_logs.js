'use strict';

const { Pool } = require('pg');
const requireMaintenanceApproval = require('./maintenance-guard');
const { readInteger } = require('../security/config');

async function main({ env = process.env, createPool = (config) => new Pool(config) } = {}) {
    requireMaintenanceApproval(env);
    const pool = createPool({
        host: env.DB_HOST,
        port: readInteger(env.DB_PORT, 5432, 1, 65535, 'DB_PORT'),
        user: env.DB_USER,
        password: env.DB_PASSWORD,
        database: env.DB_NAME,
        ssl: env.DB_SSL === 'true' ? { rejectUnauthorized: true, ...(env.DB_SSL_CA ? { ca: env.DB_SSL_CA } : {}) } : undefined,
        connectionTimeoutMillis: 5000,
        max: 1
    });

    try {
        const result = await pool.query('SELECT COUNT(*) AS total_count FROM activity_log');
        return Number(result.rows[0]?.total_count || 0);
    } catch {
        throw new Error('Activity log inspection failed.');
    } finally {
        await pool.end();
    }
}

if (require.main === module) {
    main().then(count => console.log(`Activity log entries: ${count}`)).catch(() => {
        console.error('Activity log inspection failed. Review the maintenance approval and database configuration.');
        process.exitCode = 1;
    });
}

module.exports = { main };
