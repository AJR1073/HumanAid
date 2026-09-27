const request = require('supertest');
const { app, db, poolQuery, verifyIdToken, fetchPublicHtml } = require('../../test/helpers');
const restricted = [
  ['get', '/api/admin/resources'], ['put', '/api/admin/resources/1'], ['post', '/api/admin/promote'],
  ['post', '/api/admin/demote'], ['get', '/api/admin/list'], ['get', '/api/admin/reports'],
  ['post', '/api/admin/reports/1/resolve'], ['post', '/api/admin/cleanup-junk'], ['post', '/api/admin/auto-categorize'],
  ['get', '/api/admin/analytics/views'], ['get', '/api/admin/analytics/realtime'],
  ['get', '/api/submissions'], ['get', '/api/submissions/pending'], ['patch', '/api/submissions/1']
];
describe('Authentication and administrator boundary', () => {
  test.each(restricted)('rejects missing authentication: %s %s', async (method, path) => {
    await request(app)[method](path).expect(401);
    expect(poolQuery).not.toHaveBeenCalled();
  });
  test.each(restricted)('rejects non-administrator: %s %s', async (method, path) => {
    await request(app)[method](path).set('Authorization', 'Bearer user-a-token').expect(403);
    expect(poolQuery).toHaveBeenCalledWith('SELECT id, is_admin, is_active FROM users WHERE firebase_uid = $1', ['user-a']);
    expect(db).not.toHaveBeenCalled();
  });
  test.each([['get', '/api/favorites'], ['post', '/api/favorites'], ['post', '/api/users/sync'], ['post', '/api/submissions'], ['post', '/api/scan-url']])('requires login: %s %s', async (method, path) => {
    await request(app)[method](path).expect(401);
    expect(poolQuery).not.toHaveBeenCalled();
    expect(fetchPublicHtml).not.toHaveBeenCalled();
  });
  test.each(['Bearer invalid-token', 'Basic user-a-token', 'Bearer user-a-token,another'])('rejects invalid token/header %s', async (authorization) => {
    await request(app).get('/api/admin/list').set('Authorization', authorization).expect(401);
    expect(poolQuery).not.toHaveBeenCalled();
  });
  test('uses Firebase SDK revocation checking', async () => {
    await request(app).get('/api/admin/list').set('Authorization', 'Bearer admin-token').expect(200);
    expect(verifyIdToken).toHaveBeenCalledWith('admin-token', true);
  });
  test('denies inactive administrator', async () => {
    await request(app).get('/api/admin/list').set('Authorization', 'Bearer disabled-admin-token').expect(403);
    expect(db).not.toHaveBeenCalled();
  });
  test.each([null, undefined, 'true'])('denies an administrator without explicit active status: %s', async (is_active) => {
    poolQuery.mockResolvedValueOnce({ rows: [{ id: 1, is_admin: true, is_active }] });
    await request(app).get('/api/admin/list').set('Authorization', 'Bearer admin-token').expect(403);
    expect(poolQuery).toHaveBeenCalledTimes(1);
    expect(db).not.toHaveBeenCalled();
  });
  test('denies an administrator whose token email is not verified', async () => {
    verifyIdToken.mockResolvedValueOnce({ uid: 'admin-uid', email: 'admin@example.test', email_verified: false });
    await request(app).get('/api/admin/list').set('Authorization', 'Bearer admin-token').expect(403);
    expect(poolQuery).not.toHaveBeenCalled();
  });
  test('fails closed on authorization database error', async () => {
    poolQuery.mockRejectedValueOnce(new Error('synthetic-sensitive-diagnostic'));
    const response = await request(app).get('/api/admin/list').set('Authorization', 'Bearer admin-token').expect(503);
    expect(JSON.stringify(response.body)).not.toContain('synthetic-sensitive');
    expect(db).not.toHaveBeenCalled();
  });
});
