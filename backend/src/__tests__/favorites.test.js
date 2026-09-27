const request = require('supertest');
const { app, db, verifyIdToken } = require('../../test/helpers');

const user = (call) => call.set('Authorization', 'Bearer user-a-token');

describe('Favorites and verified profile ownership', () => {
  test('fetches favorites for the token UID without a browser UID', async () => {
    db.mockResolvedValueOnce({ rows: [{ id: 11 }] }).mockResolvedValueOnce({ rows: [{ resource_id: 5 }] });
    const response = await user(request(app).get('/api/favorites'));
    expect(response.status).toBe(200);
    expect(response.body.favorites).toEqual([5]);
    expect(db.mock.calls[0][1]).toEqual(['user-a']);
    expect(db.mock.calls[1][1]).toEqual([11]);
  });

  test('toggles only the token owner’s favorite', async () => {
    db.mockResolvedValueOnce({ rows: [{ id: 11 }] }).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rowCount: 1 });
    const response = await user(request(app).post('/api/favorites')).send({ resourceId: 5 });
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('added');
    expect(db).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO user_favorites'), [11, 5]);
  });

  test('new favorite user uses verified email', async () => {
    db.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: 11 }] }).mockResolvedValueOnce({ rows: [] });
    await user(request(app).post('/api/favorites')).send({ resourceId: 5 }).expect(200);
    expect(db).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO users'), ['user-a', 'a@example.test']);
  });

  test.each([
    ['get', '/api/favorites?uid=user-b', undefined],
    ['post', '/api/favorites', { uid: 'user-b', resourceId: 5 }],
    ['post', '/api/users/sync', { uid: 'user-b', displayName: 'Changed' }],
    ['post', '/api/users/sync', { email: 'b@example.test', displayName: 'Changed' }],
    ['post', '/api/users/sync', { isAdmin: true }],
    ['post', '/api/users/sync', { is_admin: true }]
  ])('rejects cross-user or privilege payload %s %s', async (method, path, body) => {
    const call = user(request(app)[method](path));
    const response = body ? await call.send(body) : await call;
    expect(response.status).toBe(403);
    expect(db).not.toHaveBeenCalled();
  });

  test('syncs UID and email from token and cannot grant admin status', async () => {
    db.mockResolvedValueOnce({ rows: [{ is_admin: false }] });
    const response = await user(request(app).post('/api/users/sync')).send({ displayName: 'Updated profile', photoURL: 'https://example.test/avatar.png' });
    expect(response.status).toBe(200);
    expect(response.body.isAdmin).toBe(false);
    const [sql, params] = db.mock.calls[0];
    expect(params).toEqual(['user-a', 'a@example.test', 'Updated profile', 'https://example.test/avatar.png']);
    expect(sql).toContain('NOW(), FALSE');
    expect(sql.split('DO UPDATE SET')[1]).not.toMatch(/is_admin\s*=/);
  });
  test('does not advertise administrator access for an unverified email', async () => {
    verifyIdToken.mockResolvedValueOnce({ uid: 'admin-uid', email: 'admin@example.test', email_verified: false });
    db.mockResolvedValueOnce({ rows: [{ is_admin: true }] });
    const response = await user(request(app).post('/api/users/sync')).send({ displayName: 'Admin' }).expect(200);
    expect(response.body.isAdmin).toBe(false);
  });
});
