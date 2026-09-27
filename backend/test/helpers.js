// All backend tests use synthetic identities, a fake database, and fake network clients.
process.env.NODE_ENV = 'test';
process.env.DB_HOST = '127.0.0.1';
process.env.DB_NAME = 'humanaid_test';
process.env.DB_USER = 'test_user';
process.env.DB_PASSWORD = 'test-only-placeholder';
delete process.env.INSTANCE_CONNECTION_NAME;
delete process.env.DB_SSL_CA;
delete process.env.DB_SSL_MODE;
delete process.env.CORS_ORIGIN;
delete process.env.CORS_ORIGINS;
delete process.env.TRUST_PROXY_HOPS;

const mockDatabaseQuery = jest.fn();
const mockVerifyIdToken = jest.fn();
const mockGetUser = jest.fn();
const mockFetchPublicHtml = jest.fn();
const mockPoolQuery = jest.fn();
const mockClientQuery = jest.fn();
const mockClientRelease = jest.fn();
const mockPoolConnect = jest.fn();

jest.mock('pg', () => ({
  Pool: jest.fn(() => ({ query: mockPoolQuery, connect: mockPoolConnect, end: jest.fn(), on: jest.fn() }))
}));
jest.mock('firebase-admin', () => ({
  apps: [{}],
  initializeApp: jest.fn(),
  auth: () => ({ verifyIdToken: mockVerifyIdToken, getUser: mockGetUser })
}));
jest.mock('firebase-functions/v2/https', () => ({ onRequest: (options, app) => app }));
jest.mock('geoip-lite', () => ({ lookup: jest.fn(() => null) }));
jest.mock('../src/services/safe-url-fetch', () => ({
  fetchPublicHtml: mockFetchPublicHtml,
  ScanUrlError: class ScanUrlError extends Error {
    constructor(message, status = 400) { super(message); this.status = status; }
  }
}), { virtual: true });

const { app } = require('../src/server');

function resetMocks() {
  jest.clearAllMocks();
  mockDatabaseQuery.mockReset().mockResolvedValue({ rows: [], rowCount: 0 });
  mockVerifyIdToken.mockReset().mockImplementation(async (token) => {
    const identities = {
      'admin-token': { uid: 'admin-uid', email: 'admin@example.test', email_verified: true, name: 'Admin' },
      'user-a-token': { uid: 'user-a', email: 'a@example.test', email_verified: true, name: 'User A' },
      'user-b-token': { uid: 'user-b', email: 'b@example.test', email_verified: true, name: 'User B' },
      'disabled-admin-token': { uid: 'disabled-admin', email: 'disabled@example.test', email_verified: true }
    };
    if (!identities[token]) throw new Error('Synthetic invalid token');
    return identities[token];
  });
  mockGetUser.mockReset().mockResolvedValue({ uid: 'other-uid', email: 'other@example.test', emailVerified: true, disabled: false });
  mockClientQuery.mockReset().mockResolvedValue({ rows: [], rowCount: 0 });
  mockClientRelease.mockReset();
  mockPoolConnect.mockReset().mockResolvedValue({ query: mockClientQuery, release: mockClientRelease });
  mockPoolQuery.mockReset().mockImplementation(async (sql, params) => {
    if (sql === 'SELECT id, is_admin, is_active FROM users WHERE firebase_uid = $1') {
      return { rows: [{ id: 1, is_admin: ['admin-uid', 'disabled-admin'].includes(params[0]), is_active: params[0] !== 'disabled-admin' }] };
    }
    return mockDatabaseQuery(sql, params);
  });
  mockFetchPublicHtml.mockReset().mockResolvedValue('<html><head><title>Food Pantry</title></head><body></body></html>');
}

beforeEach(resetMocks);

module.exports = { app, db: mockDatabaseQuery, poolQuery: mockPoolQuery, poolConnect: mockPoolConnect, clientQuery: mockClientQuery, clientRelease: mockClientRelease, verifyIdToken: mockVerifyIdToken, getUser: mockGetUser, fetchPublicHtml: mockFetchPublicHtml };
