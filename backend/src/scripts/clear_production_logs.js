'use strict';

const { Pool } = require('pg');
const requireMaintenanceApproval = require('./maintenance-guard');
const { readInteger } = require('../security/config');

async function main({ env = process.env, createPool = (config) => new Pool(config) } = {}) {
    if (env.ALLOW_CLEAR_ACTIVITY_LOG !== 'true') {
        throw new Error('Explicit ALLOW_CLEAR_ACTIVITY_LOG=true approval is required for activity log deletion.');
    }
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
        const result = await pool.query('DELETE FROM activity_log');
        return result.rowCount;
    } catch {
        throw new Error('Activity log cleanup failed.');
    } finally {
        await pool.end();
    }
}

if (require.main === module) {
    main().then(count => console.log(`Activity log cleanup complete: ${count} row(s) removed.`)).catch(() => {
        console.error('Activity log cleanup failed. Review the maintenance approval and database configuration.');
        process.exitCode = 1;
    });
}

module.exports = { main };
