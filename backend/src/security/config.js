const net = require('node:net');

function readInteger(value, fallback, min, max, name) {
  if (value === undefined || value === '') return fallback;
  if (!/^\d+$/.test(String(value)) || Number(value) < min || Number(value) > max) {
    throw new Error(`Invalid configuration for ${name}`);
  }
  return Number(value);
}

function databaseConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const instance = env.INSTANCE_CONNECTION_NAME;
  const host = env.DB_HOST || '127.0.0.1';
  if (production) {
    const missing = ['DB_USER', 'DB_PASSWORD', 'DB_NAME'].filter((key) => !env[key]);
    if (!instance && !env.DB_HOST) missing.push('DB_HOST or INSTANCE_CONNECTION_NAME');
    if (missing.length) throw new Error(`Missing database configuration: ${missing.join(', ')}`);
  }
  if (instance && !/^[a-z][a-z0-9-]{4,62}:[a-z0-9-]+:[a-z][a-z0-9-]*$/.test(instance)) {
    throw new Error('Invalid configuration for INSTANCE_CONNECTION_NAME');
  }
  const loopback = ['localhost', '127.0.0.1', '::1'].includes(host);
  if (!production && (instance || !loopback) && env.ALLOW_REMOTE_DATABASE !== 'true') {
    throw new Error('Remote database access requires explicit ALLOW_REMOTE_DATABASE outside production');
  }
  const sslMode = env.DB_SSL_MODE || (production && !instance ? 'verify-full' : 'disable');
  if (!['disable', 'require', 'verify-full'].includes(sslMode)) {
    throw new Error('Invalid configuration for DB_SSL_MODE');
  }
  if (production && !instance && sslMode !== 'verify-full') {
    throw new Error('Production TCP database connections require DB_SSL_MODE=verify-full');
  }
  if (env.DB_HOST && !instance && !(net.isIP(host) || /^[a-z0-9.-]+$/i.test(host))) {
    throw new Error('Invalid configuration for DB_HOST');
  }
  return {
    host: instance ? `/cloudsql/${instance}` : host,
    port: readInteger(env.DB_PORT, 5432, 1, 65535, 'DB_PORT'),
    user: env.DB_USER || 'humanaid_app',
    password: env.DB_PASSWORD,
    database: env.DB_NAME || 'humanaid_dev',
    ssl: instance || sslMode === 'disable' ? false : {
      rejectUnauthorized: sslMode === 'verify-full',
      ...(env.DB_SSL_CA ? { ca: env.DB_SSL_CA } : {})
    },
    max: readInteger(env.DB_POOL_MAX, 5, 1, 20, 'DB_POOL_MAX'),
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    statement_timeout: 30000
  };
}

function corsOptions(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const raw = env.CORS_ORIGINS || env.CORS_ORIGIN || '';
  const origins = raw.split(',').map((origin) => origin.trim()).filter(Boolean);
  if (production && !origins.length) throw new Error('CORS_ORIGINS is required in production');
  if (!production) origins.push('http://localhost:3000', 'http://localhost:5173', 'http://localhost:4173');
  for (const origin of origins) {
    let url;
    try { url = new URL(origin); } catch { throw new Error('Invalid configuration for CORS_ORIGINS'); }
    if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol) ||
        (production && url.protocol !== 'https:')) {
      throw new Error('CORS_ORIGINS must contain exact allowed web origins');
    }
  }
  return {
    origin(origin, callback) {
      if (!origin || origins.includes(origin)) return callback(null, true);
      const error = new Error('Origin not allowed');
      error.status = 403;
      return callback(error);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 600
  };
}

function assertFirebaseAuthEnvironment(env = process.env) {
  if (env.NODE_ENV === 'production' && env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error('FIREBASE_AUTH_EMULATOR_HOST must be unset in production');
  }
}

module.exports = { databaseConfig, corsOptions, readInteger, assertFirebaseAuthEnvironment };
