const request = require('supertest');
const { app, db, clientQuery, clientRelease, poolConnect } = require('../../test/helpers');

describe('Analytics API contracts', () => {
  test('resource event and counter commit together on one client with a public-safe response', async () => {
    clientQuery.mockResolvedValueOnce({ rows: [] });
    clientQuery.mockResolvedValueOnce({ rows: [{ id: 11 }] });
    const response = await request(app).post('/api/analytics/track')
      .set('Authorization', 'Bearer user-a-token')
      .send({ resource_id: 1, action_type: 'view_resource', details: { source: 'global_search' } });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
    expect(poolConnect).toHaveBeenCalledTimes(1);
    expect(clientQuery.mock.calls.map(([sql]) => sql)).toEqual([
      'BEGIN',
      'SELECT id FROM users WHERE firebase_uid = $1',
      expect.stringContaining('INSERT INTO activity_log'),
      'UPDATE resources SET view_count = view_count + 1 WHERE id = $1 AND is_active = true AND approval_status = $2',
      'COMMIT'
    ]);
    expect(clientQuery.mock.calls[1][1]).toEqual(['user-a']);
    expect(clientQuery.mock.calls[2][1].slice(0, 3)).toEqual([11, 1, 'view_resource']);
    expect(clientQuery.mock.calls[3][1]).toEqual([1, 'approved']);
    expect(clientRelease).toHaveBeenCalledTimes(1);
    expect(db).not.toHaveBeenCalled();
  });

  test('counter failure rolls back the event and does not return partial success', async () => {
    clientQuery.mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error('synthetic counter failure'));

    const response = await request(app).post('/api/analytics/track')
      .send({ resource_id: 1, action_type: 'view_resource' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Failed to track activity' });
    expect(clientQuery).toHaveBeenCalledWith('ROLLBACK');
    expect(clientQuery).not.toHaveBeenCalledWith('COMMIT');
    expect(clientRelease).toHaveBeenCalledTimes(1);
  });

  test('event insert failure skips the counter update, rolls back and releases the client', async () => {
    clientQuery.mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error('synthetic event failure'));

    const response = await request(app).post('/api/analytics/track')
      .send({ resource_id: 1, action_type: 'view_resource' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Failed to track activity' });
    expect(clientQuery.mock.calls.some(([sql]) => sql.includes('UPDATE resources'))).toBe(false);
    expect(clientQuery).toHaveBeenCalledWith('ROLLBACK');
    expect(clientQuery).not.toHaveBeenCalledWith('COMMIT');
    expect(clientRelease).toHaveBeenCalledTimes(1);
  });

  test('accepts legacy matching resource_id and rejects mismatches', async () => {
    await request(app).post('/api/analytics/track').send({ resource_id: 1, action_type: 'view_resource', details: { resource_id: 2 } }).expect(400);
    expect(db).not.toHaveBeenCalled();
    await request(app).post('/api/analytics/track').send({ action_type: 'view_resource', details: { resource_id: 1 } }).expect(200);
    const insert = clientQuery.mock.calls.find(([sql]) => sql.includes('INSERT INTO activity_log'));
    expect(insert[1][1]).toBe(1);
  });

  test('rejects unverified and cross-user analytics identity', async () => {
    await request(app).post('/api/analytics/track').send({ user_id: 'user-b', resource_id: 1, action_type: 'view_resource' }).expect(403);
    await request(app).post('/api/analytics/track').set('Authorization', 'Bearer user-a-token').send({ user_id: 'user-b', resource_id: 1, action_type: 'view_resource' }).expect(403);
    expect(db).not.toHaveBeenCalled();
  });

  test('derives logged user from token', async () => {
    clientQuery.mockResolvedValueOnce({ rows: [] });
    clientQuery.mockResolvedValueOnce({ rows: [{ id: 11 }] });
    await request(app).post('/api/analytics/track').set('Authorization', 'Bearer user-a-token').send({ resource_id: 5, action_type: 'view_resource' }).expect(200);
    expect(clientQuery.mock.calls[1][1]).toEqual(['user-a']);
    expect(clientQuery.mock.calls[2][1].slice(0, 3)).toEqual([11, 5, 'view_resource']);
  });

  test('admin dashboard events require administrator access', async () => {
    await request(app).post('/api/analytics/track').send({ action_type: 'view_admin_dashboard' }).expect(401);
    await request(app).post('/api/analytics/track').set('Authorization', 'Bearer user-a-token').send({ action_type: 'view_admin_dashboard' }).expect(403);
    expect(db).not.toHaveBeenCalled();
  });

  test('preserves aggregated analytics including location data', async () => {
    db.mockResolvedValueOnce({ rows: [{ date: '2026-01-01', count: 10 }] })
      .mockResolvedValueOnce({ rows: [{ name: 'Resource', views: 5 }] })
      .mockResolvedValueOnce({ rows: [{ ua: 'Mozilla/5.0 (Mobile)' }] })
      .mockResolvedValueOnce({ rows: [{ location: 'City, IL', views: 5 }] });
    const response = await request(app).get('/api/admin/analytics/views').set('Authorization', 'Bearer admin-token');
    expect(response.status).toBe(200);
    expect(response.body.deviceData).toEqual([{ name: 'Mobile', value: 1 }]);
    expect(response.body.locationData).toEqual([{ location: 'City, IL', views: 5 }]);
  });
});
