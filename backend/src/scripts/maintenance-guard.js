'use strict';
module.exports = function requireMaintenanceApproval(env = process.env) {
    if (env.ALLOW_DATABASE_MAINTENANCE !== 'true') {
        throw new Error('Database maintenance is disabled. Review the script and target, then explicitly set ALLOW_DATABASE_MAINTENANCE=true.');
    }
    for (const key of ['DB_HOST', 'DB_USER', 'DB_NAME', 'DB_PASSWORD']) {
        if (!env[key]) throw new Error(`${key} must be supplied in the operator environment.`);
    }
    const local = ['localhost', '127.0.0.1', '::1'].includes(env.DB_HOST);
    if (env.NODE_ENV === 'production' && env.DB_SSL !== 'true') {
        throw new Error('Production maintenance requires DB_SSL=true with verified TLS.');
    }
    if (!local && (env.ALLOW_REMOTE_DATABASE !== 'true' || env.DB_SSL !== 'true')) {
        throw new Error('Remote maintenance requires explicit ALLOW_REMOTE_DATABASE=true and DB_SSL=true with verified TLS.');
    }
};
