'use strict';
const { Pool } = require('pg');
const admin = require('firebase-admin');
const requireMaintenanceApproval = require('./maintenance-guard');
const { readInteger } = require('../security/config');

async function main({
    env = process.env,
    uid = process.argv[2],
    getUser = async (targetUid) => {
        if (!admin.apps.length) {
            const projectId = env.FIREBASE_PROJECT_ID || env.GOOGLE_CLOUD_PROJECT;
            admin.initializeApp(projectId ? { projectId } : undefined);
        }
        return admin.auth().getUser(targetUid);
    },
    createPool = (config) => new Pool(config)
} = {}) {
    if (env.ALLOW_ADMIN_BOOTSTRAP !== 'true' || typeof uid !== 'string' || !uid || uid.length > 128) {
        throw new Error('Requires explicit ALLOW_ADMIN_BOOTSTRAP=true and a verified Firebase UID argument.');
    }
    requireMaintenanceApproval(env);
    if (env.FIREBASE_AUTH_EMULATOR_HOST) {
        throw new Error('Administrator bootstrap cannot use the Firebase Auth emulator.');
    }
    const port = readInteger(env.DB_PORT, 5432, 1, 65535, 'DB_PORT');
    const identity = await getUser(uid);
    if (!identity || identity.uid !== uid || identity.disabled !== false || identity.emailVerified !== true ||
        typeof identity.email !== 'string' || !identity.email.trim()) {
        throw new Error('Only enabled accounts with verified email can become administrators.');
    }
    const pool = createPool({
        host: env.DB_HOST,
        port,
        database: env.DB_NAME,
        user: env.DB_USER,
        password: env.DB_PASSWORD,
        ssl: env.DB_SSL === 'true' ? {
            rejectUnauthorized: true,
            ...(env.DB_SSL_CA ? { ca: env.DB_SSL_CA } : {})
        } : undefined,
        connectionTimeoutMillis: 5000,
        max: 1
    });
    try {
        const result = await pool.query(
            'UPDATE users SET is_admin = TRUE WHERE firebase_uid = $1 AND is_active = TRUE AND LOWER(email) = $2 RETURNING id',
            [identity.uid, identity.email.trim().toLowerCase()]
        );
        if (result.rowCount !== 1) throw new Error('An active user must sign in and sync the verified email before operator bootstrap.');
        return true;
    } finally {
        await pool.end();
    }
}

if (require.main === module) {
    Promise.resolve().then(() => {
        const path = require('node:path');
        if (process.env.NODE_ENV !== 'test') require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
        return main();
    }).then(() => console.log('Verified account promoted.')).catch(() => {
        console.error('Admin bootstrap failed. Verify explicit operator approval, account identity and configuration.');
        process.exitCode = 1;
    });
}
module.exports = { main };
