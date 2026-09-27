const express = require('express');
const request = require('supertest');
const { databaseConfig, corsOptions, assertFirebaseAuthEnvironment } = require('../security/config');
const { createRateLimiter } = require('../security/rate-limit');

describe('Database and CORS configuration', () => {
  const production = { NODE_ENV: 'production', DB_HOST: 'db.example.test', DB_NAME: 'test', DB_USER: 'test', DB_PASSWORD: 'synthetic-test-only' };
  test('production rejects Firebase authentication emulator bypass', () => {
    expect(() => assertFirebaseAuthEnvironment({ NODE_ENV: 'production', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' })).toThrow('must be unset');
    expect(() => assertFirebaseAuthEnvironment({ NODE_ENV: 'production' })).not.toThrow();
  });
  test('defaults only to local development without a password', () => {
    const config = databaseConfig({ NODE_ENV: 'development' });
    expect(config.host).toBe('127.0.0.1');
    expect(config.database).toBe('humanaid_dev');
    expect(config.password).toBeUndefined();
  });
  test('fails closed when production database configuration is missing', () => {
    expect(() => databaseConfig({ NODE_ENV: 'production' })).toThrow('Missing database configuration');
    expect(() => databaseConfig({ ...production, DB_PASSWORD: '' })).toThrow('DB_PASSWORD');
  });
  test('requires explicit remote-development opt-in', () => {
    expect(() => databaseConfig({ ...production, NODE_ENV: 'development' })).toThrow('ALLOW_REMOTE_DATABASE');
    expect(() => databaseConfig({ NODE_ENV: 'development', INSTANCE_CONNECTION_NAME: 'sample-project:us-central1:test-db' })).toThrow('ALLOW_REMOTE_DATABASE');
  });
  test('requires verified TLS for production TCP', () => {
    expect(databaseConfig(production).ssl.rejectUnauthorized).toBe(true);
    expect(() => databaseConfig({ ...production, DB_SSL_MODE: 'disable' })).toThrow('verify-full');
    expect(() => databaseConfig({ ...production, DB_SSL_MODE: 'require' })).toThrow('verify-full');
  });
  test('supports explicit Cloud SQL socket configuration', () => {
    const config = databaseConfig({ ...production, DB_HOST: undefined, INSTANCE_CONNECTION_NAME: 'sample-project:us-central1:test-db' });
    expect(config.host).toBe('/cloudsql/sample-project:us-central1:test-db');
    expect(config.ssl).toBe(false);
    expect(config.max).toBe(5);
  });
  test('requires exact HTTPS production CORS origins', () => {
    expect(() => corsOptions({ NODE_ENV: 'production' })).toThrow('CORS_ORIGINS');
    expect(() => corsOptions({ NODE_ENV: 'production', CORS_ORIGINS: '*' })).toThrow();
    expect(() => corsOptions({ NODE_ENV: 'production', CORS_ORIGINS: 'http://example.test' })).toThrow();
    const cors = corsOptions({ NODE_ENV: 'production', CORS_ORIGINS: 'https://example.test' });
    const allowed = jest.fn(); cors.origin('https://example.test', allowed);
    expect(allowed).toHaveBeenCalledWith(null, true);
    const denied = jest.fn(); cors.origin('https://example.test.attacker.test', denied);
    expect(denied.mock.calls[0][0].status).toBe(403);
  });
});

describe('Request rate limits', () => {
  test('cannot bypass limit with arbitrary X-Forwarded-For and recovers after window', async () => {
    let time = 1000;
    const app = express();
    app.use(createRateLimiter({ limit: 2, windowMs: 1000, now: () => time }));
    app.get('/', (req, res) => res.json({ ok: true }));
    await request(app).get('/').expect(200);
    await request(app).get('/').set('X-Forwarded-For', '1.1.1.1').expect(200);
    const response = await request(app).get('/').set('X-Forwarded-For', '8.8.8.8').expect(429);
    expect(response.headers['retry-after']).toBe('1');
    time += 1000;
    await request(app).get('/').expect(200);
  });
});
