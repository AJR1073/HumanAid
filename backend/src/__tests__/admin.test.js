const request = require('supertest');
const { app, db, getUser, poolQuery, clientQuery, clientRelease } = require('../../test/helpers');

const admin = (call) => call.set('Authorization', 'Bearer admin-token');

describe('Admin API feature regressions', () => {
  test('lists resources and preserves pagination', async () => {
    db.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Resource 1', zip_code: '62298' }] })
      .mockResolvedValueOnce({ rows: [{ count: 1 }] });
    const response = await admin(request(app).get('/api/admin/resources?search=&missing_zip=false'));
    expect(response.status).toBe(200);
    expect(response.body.resources).toHaveLength(1);
    expect(response.body.totalPages).toBe(1);
    expect(db).toHaveBeenCalledTimes(2);
  });

  test('filters missing ZIP codes', async () => {
    db.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ count: 0 }] });
    const response = await admin(request(app).get('/api/admin/resources?missing_zip=true'));
    expect(response.status).toBe(200);
    expect(db.mock.calls[0][0]).toContain('zip_code IS NULL');
  });

  test('updates resource fields, including email and service details', async () => {
    db.mockResolvedValueOnce({ rowCount: 1 });
    const response = await admin(request(app).put('/api/admin/resources/123')).send({
      name: 'Updated Name', address: '123 St', city: 'City', state: 'IL', zip_code: '12345',
      phone: '555-5555', email: 'updated@example.test', website: 'https://example.test', hours: '9-5',
      primary_category_id: 1, is_active: true, eligibility_requirements: 'Must be resident',
      appointment_required: true, walk_ins_accepted: false, food_dist_type: 'boxes',
      food_dist_onsite: true, service_area: 'Metro', languages_spoken: 'English, Spanish'
    });
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(db.mock.calls[0][1]).toEqual(expect.arrayContaining(['updated@example.test', 'Must be resident', 'boxes', ['English', 'Spanish']]));
  });

  test('resolves a report', async () => {
    db.mockResolvedValueOnce({ rows: [{ id: 3 }], rowCount: 1 });
    const response = await admin(request(app).post('/api/admin/reports/3/resolve')).send({ status: 'resolved' });
    expect(response.status).toBe(200);
    expect(db).toHaveBeenCalledWith(expect.stringContaining("AND status = 'pending' RETURNING id"), ['resolved', '3']);
  });

  test('does not overwrite an already resolved report', async () => {
    db.mockResolvedValueOnce({ rows: [], rowCount: 0 }).mockResolvedValueOnce({ rows: [{ status: 'resolved' }], rowCount: 1 });
    await admin(request(app).post('/api/admin/reports/3/resolve')).send({ status: 'dismissed' }).expect(409);
    expect(db.mock.calls[0][0]).toContain("AND status = 'pending'");
    expect(db.mock.calls[1][0]).toContain('SELECT status FROM resource_reports');
  });

  test('distinguishes a missing report during resolution', async () => {
    db.mockResolvedValueOnce({ rows: [], rowCount: 0 }).mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await admin(request(app).post('/api/admin/reports/999/resolve')).send({ status: 'resolved' }).expect(404);
  });

  test('does not accept caller-supplied reviewer identity', async () => {
    await admin(request(app).post('/api/admin/reports/3/resolve'))
      .send({ status: 'resolved', reviewer_uid: 'forged-user' }).expect(400);
    expect(db).not.toHaveBeenCalled();
  });

  describe('cleanup junk transaction', () => {
    test('commits a successful batch using only the acquired client', async () => {
      clientQuery.mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Liquor Store' }, { id: 2, name: 'Smoke Shop' }] })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [] });
      const response = await admin(request(app).post('/api/admin/cleanup-junk')).expect(200);
      expect(response.body).toMatchObject({ success: true, count: 2 });
      expect(clientQuery.mock.calls.map(([sql]) => sql)).toEqual([
        'BEGIN', 'SELECT id, name, description FROM resources WHERE is_active = true',
        'UPDATE resources SET is_active = false WHERE id = $1',
        'UPDATE resources SET is_active = false WHERE id = $1', 'COMMIT'
      ]);
      expect(poolQuery).toHaveBeenCalledTimes(1); // admin authorization only
      expect(clientRelease).toHaveBeenCalledTimes(1);
    });

    test('rolls back the whole batch after a later update fails', async () => {
      clientQuery.mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Liquor Store' }, { id: 2, name: 'Smoke Shop' }] })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockRejectedValueOnce(new Error('synthetic-private-diagnostic'))
        .mockResolvedValueOnce({ rows: [] });
      const response = await admin(request(app).post('/api/admin/cleanup-junk')).expect(500);
      expect(response.body).toEqual({ error: 'Failed to cleanup junk' });
      expect(clientQuery).not.toHaveBeenCalledWith('COMMIT');
      expect(clientQuery).toHaveBeenLastCalledWith('ROLLBACK');
      expect(clientRelease).toHaveBeenCalledTimes(1);
    });

    test('commits an empty/no-op batch safely', async () => {
      clientQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
      const response = await admin(request(app).post('/api/admin/cleanup-junk')).expect(200);
      expect(response.body).toMatchObject({ success: true, count: 0 });
      expect(clientQuery).toHaveBeenLastCalledWith('COMMIT');
      expect(clientRelease).toHaveBeenCalledTimes(1);
    });
  });

  describe('auto-categorize transaction', () => {
    const categoryRows = [{ id: 10, slug: 'substance-abuse-treatment' }];
    const resourceRows = [
      { id: 1, name: 'Recovery Center', description: '', primary_category_id: 99 },
      { id: 2, name: 'Alcohol Support', description: '', primary_category_id: 99 }
    ];

    test('commits all category updates through one acquired client', async () => {
      clientQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: categoryRows })
        .mockResolvedValueOnce({ rows: resourceRows }).mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [] });
      const response = await admin(request(app).post('/api/admin/auto-categorize')).expect(200);
      expect(response.body).toMatchObject({ success: true, updated: 2 });
      expect(clientQuery.mock.calls.map(([sql]) => sql)).toEqual([
        'BEGIN', 'SELECT id, slug FROM categories',
        'SELECT id, name, description, primary_category_id FROM resources WHERE is_active = true',
        'UPDATE resources SET primary_category_id = $1 WHERE id = $2',
        'UPDATE resources SET primary_category_id = $1 WHERE id = $2', 'COMMIT'
      ]);
      expect(poolQuery).toHaveBeenCalledTimes(1); // admin authorization only
      expect(clientRelease).toHaveBeenCalledTimes(1);
    });

    test('rolls back and returns no partial-success result when an update fails', async () => {
      clientQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: categoryRows })
        .mockResolvedValueOnce({ rows: resourceRows }).mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockRejectedValueOnce(new Error('synthetic-private-diagnostic'))
        .mockResolvedValueOnce({ rows: [] });
      const response = await admin(request(app).post('/api/admin/auto-categorize')).expect(500);
      expect(response.body).toEqual({ error: 'Failed to auto-categorize' });
      expect(clientQuery).not.toHaveBeenCalledWith('COMMIT');
      expect(clientQuery).toHaveBeenLastCalledWith('ROLLBACK');
      expect(poolQuery).toHaveBeenCalledTimes(1); // admin authorization only
      expect(clientRelease).toHaveBeenCalledTimes(1);
    });
  });

  test('records the verified reviewer for a submission', async () => {
    clientQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: 9, status: 'pending' }] });
    const response = await admin(request(app).patch('/api/submissions/9')).send({ action: 'reject', reviewedBy: 'forged@example.test' });
    expect(response.status).toBe(200);
    expect(clientQuery).toHaveBeenCalledWith(expect.stringContaining('UPDATE pending_submissions'), ['rejected', 'admin@example.test', '9']);
    expect(clientQuery).toHaveBeenLastCalledWith('COMMIT');
    expect(clientRelease).toHaveBeenCalledTimes(1);
  });

  test('publishes approval status and tags atomically', async () => {
    clientQuery.mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 9, status: 'pending', name: 'Food Pantry', tags: ['Food'] }] })
      .mockResolvedValueOnce({ rows: [{ id: 42 }] })
      .mockResolvedValueOnce({ rows: [{ id: 7 }] });
    const response = await admin(request(app).patch('/api/submissions/9')).send({ action: 'approve' }).expect(200);
    expect(response.body.resourceId).toBe(42);
    expect(clientQuery.mock.calls[1]).toEqual(['SELECT * FROM pending_submissions WHERE id = $1 FOR UPDATE', ['9']]);
    expect(clientQuery.mock.calls[2][0]).toContain('approval_status');
    expect(clientQuery.mock.calls[2][0]).toContain("true, 'approved'");
    expect(clientQuery).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO resource_tags'), [42, 7]);
    expect(clientQuery).toHaveBeenCalledWith(expect.stringContaining('UPDATE pending_submissions'), ['approved', 'admin@example.test', '9']);
    expect(clientQuery).toHaveBeenLastCalledWith('COMMIT');
    expect(db).not.toHaveBeenCalled();
    expect(clientRelease).toHaveBeenCalledTimes(1);
  });

  test.each(['approved', 'rejected'])('does not publish an already %s submission', async (status) => {
    clientQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: 9, status }] });
    await admin(request(app).patch('/api/submissions/9')).send({ action: 'approve' }).expect(409);
    expect(clientQuery).toHaveBeenCalledTimes(3);
    expect(clientQuery).toHaveBeenLastCalledWith('ROLLBACK');
    expect(clientRelease).toHaveBeenCalledTimes(1);
  });

  test('approves a maximum-length name without exceeding the slug column limit', async () => {
    clientQuery.mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 9, status: 'pending', name: 'N'.repeat(500), tags: [] }] })
      .mockResolvedValueOnce({ rows: [{ id: 42 }] });
    await admin(request(app).patch('/api/submissions/9')).send({ action: 'approve' }).expect(200);
    const [, params] = clientQuery.mock.calls.find(([sql]) => sql.includes('INSERT INTO resources'));
    expect(params[0]).toHaveLength(500);
    expect(params[1]).toHaveLength(500);
    expect(params[1]).toMatch(/-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
    expect(clientQuery).toHaveBeenLastCalledWith('COMMIT');
  });

  test('rolls back publication if linking a tag fails', async () => {
    clientQuery.mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 9, status: 'pending', name: 'Food Pantry', tags: ['Food'] }] })
      .mockResolvedValueOnce({ rows: [{ id: 42 }] })
      .mockResolvedValueOnce({ rows: [{ id: 7 }] })
      .mockRejectedValueOnce(new Error('synthetic-private-diagnostic'));
    const response = await admin(request(app).patch('/api/submissions/9')).send({ action: 'approve' }).expect(500);
    expect(JSON.stringify(response.body)).not.toContain('synthetic-private');
    expect(clientQuery).toHaveBeenLastCalledWith('ROLLBACK');
    expect(clientQuery).not.toHaveBeenCalledWith('COMMIT');
    expect(clientQuery.mock.calls.some(([sql]) => sql.includes('UPDATE pending_submissions'))).toBe(false);
    expect(clientRelease).toHaveBeenCalledTimes(1);
  });

  test('promotes only the Firebase identity with a current verified matching email', async () => {
    db.mockResolvedValueOnce({ rows: [{ firebase_uid: 'other-uid' }] });
    await admin(request(app).post('/api/admin/promote')).send({ email: 'Other@Example.test' }).expect(200);
    expect(getUser).toHaveBeenCalledWith('other-uid');
    expect(db).toHaveBeenCalledWith('SELECT firebase_uid FROM users WHERE LOWER(email) = $1', ['other@example.test']);
    expect(db).toHaveBeenLastCalledWith('UPDATE users SET is_admin = TRUE WHERE firebase_uid = $1', ['other-uid']);
  });

  test.each([
    { emailVerified: false }, { disabled: true }, { email: 'someone-else@example.test' }, { uid: 'different-uid' }
  ])('rejects an invalid target identity %j', async (override) => {
    db.mockResolvedValueOnce({ rows: [{ firebase_uid: 'other-uid' }] });
    getUser.mockResolvedValueOnce({ uid: 'other-uid', email: 'other@example.test', emailVerified: true, disabled: false, ...override });
    await admin(request(app).post('/api/admin/promote')).send({ email: 'other@example.test' }).expect(403);
    expect(db).toHaveBeenCalledTimes(1);
  });

  test('fails closed when target Firebase verification is unavailable', async () => {
    db.mockResolvedValueOnce({ rows: [{ firebase_uid: 'other-uid' }] });
    getUser.mockRejectedValueOnce(new Error('synthetic-private-diagnostic'));
    const response = await admin(request(app).post('/api/admin/promote')).send({ email: 'other@example.test' }).expect(503);
    expect(JSON.stringify(response.body)).not.toContain('synthetic-private');
    expect(db).toHaveBeenCalledTimes(1);
  });

  test('permits an authorized administrator to demote another user', async () => {
    await admin(request(app).post('/api/admin/demote')).send({ email: 'other@example.test' }).expect(200);
    expect(db).toHaveBeenCalledWith('UPDATE users SET is_admin = FALSE WHERE email = $1', ['other@example.test']);
  });
});
