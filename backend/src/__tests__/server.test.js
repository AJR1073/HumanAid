const request = require('supertest');
const { app, db, poolQuery, fetchPublicHtml } = require('../../test/helpers');
const user = (call) => call.set('Authorization', 'Bearer user-a-token');
const submission = { name: 'Test Organization', description: 'Description', address: '123 Main St', city: 'Test City', state: 'IL', zipCode: '12345', email: 'contact@example.test', primaryCategoryId: 1 };

describe('Public API and input hardening', () => {
  test('public health returns basic status and db-health no longer exists', async () => {
    const response = await request(app).get('/api/health').expect(200);
    expect(response.body).toEqual({ status: 'ok' });
    await request(app).get('/api/db-health').expect(404);
    expect(poolQuery).not.toHaveBeenCalled();
  });
  test('preserves category filtering for current frontend modes', async () => {
    db.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Food' }] });
    const response = await request(app).get('/api/categories?mode=need_help').expect(200);
    expect(response.body.categories).toHaveLength(1);
    expect(db.mock.calls[0][1]).toEqual(['need_help']);
  });
  test('database errors do not disclose diagnostics in responses or logs', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    db.mockRejectedValueOnce(new Error('synthetic-sensitive-diagnostic'));
    const response = await request(app).get('/api/categories').expect(500);
    expect(JSON.stringify(response.body)).not.toContain('synthetic-sensitive');
    expect(JSON.stringify(log.mock.calls)).not.toContain('synthetic-sensitive');
    log.mockRestore();
  });
  test('preserves resource and favorite ID filters in the actual app', async () => {
    db.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rows: [{ total: 1 }] });
    await request(app).get('/api/resources?city=Alton&state=IL&ids=1,2,3&limit=1000&mode=need_help').expect(200);
    expect(db.mock.calls[0][1]).toEqual(['Alton', 'IL', 'need_help', [1, 2, 3], 1000]);
    expect(db.mock.calls[0][0]).toContain('r.id = ANY($4)');
    expect(db.mock.calls[0][0]).toContain("c.mode = $3 OR c.mode = 'both'");
    expect(db.mock.calls[1][1]).toEqual(['Alton', 'IL', 'need_help', [1, 2, 3]]);
  });
  test('zero coordinates remain location filters', async () => {
    db.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ total: 0 }] });
    await request(app).get('/api/resources?lat=0&lon=0').expect(200);
    expect(db.mock.calls[0][0]).toContain('ST_DWithin');
    expect(db.mock.calls[0][1].slice(0, 2)).toEqual([0, 0]);
  });
  test.each(['/api/search', '/api/resources/search'])('preserves search contract %s', async (path) => {
    db.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    const response = await request(app).get(`${path}?q=pantry&mode=need_help`).expect(200);
    expect(response.body.searchMode).toBe('global');
    expect(db.mock.calls[0][1]).toEqual(['pantry', 20]);
  });
  test.each(['/api/resources?limit=1001', '/api/resources?limit=-1', '/api/resources?lat=91&lon=0', '/api/resources?lat=0', '/api/resources?ids=1,bad,2', '/api/resources?ids=', '/api/resources?ids=%20%20', '/api/search?q[]=pantry', '/api/search?q=x&radius=501', '/api/resources/not-an-id'])('rejects invalid input: %s', async (path) => {
    await request(app).get(path).expect(400);
    expect(db).not.toHaveBeenCalled();
  });
  test('rejects malformed and oversized JSON', async () => {
    await user(request(app).post('/api/submissions')).set('Content-Type', 'application/json').send('{ broken').expect(400);
    await user(request(app).post('/api/submissions')).send({ name: 'x'.repeat(70000) }).expect(413);
    expect(db).not.toHaveBeenCalled();
  });
  test('validates required submission fields', async () => {
    await user(request(app).post('/api/submissions')).send({ name: 'Missing fields' }).expect(400);
    expect(db).not.toHaveBeenCalled();
  });
  test('stores only verified submission identity', async () => {
    db.mockResolvedValueOnce({ rows: [{ id: 123 }] });
    const response = await user(request(app).post('/api/submissions')).send(submission).expect(201);
    expect(response.body.submissionId).toBe(123);
    expect(db.mock.calls[0][1].slice(-3)).toEqual(['a@example.test', 'User A', 'user-a']);
  });
  test('rejects forged submission author', async () => {
    await user(request(app).post('/api/submissions')).send({ ...submission, submittedByUid: 'user-b' }).expect(403);
    await user(request(app).post('/api/submissions')).send({ ...submission, submittedBy: 'b@example.test' }).expect(403);
    expect(db).not.toHaveBeenCalled();
  });

  test('public resource detail excludes unapproved and inactive records', async () => {
    await request(app).get('/api/resources/1').expect(404);
    expect(db.mock.calls[0][0]).toContain("r.approval_status = 'approved'");
    expect(db.mock.calls[0][0]).toContain('r.is_active = true');
  });
  test('scan route uses the safe helper and preserves extraction', async () => {
    fetchPublicHtml.mockResolvedValueOnce('<title>Pantry - Home</title><a href="tel:6185551234">Call</a>');
    const response = await user(request(app).post('/api/scan-url')).send({ url: 'https://example.test' }).expect(200);
    expect(response.body.title).toBe('Pantry');
    expect(response.body.phone).toBe('6185551234');
    expect(fetchPublicHtml).toHaveBeenCalledWith('https://example.test');
  });
  test('scan ignores non-string JSON-LD fields and caps returned text', async () => {
    const schema = { address: { streetAddress: { unexpected: true }, addressLocality: ['City'], addressRegion: 7, postalCode: null } };
    fetchPublicHtml.mockResolvedValueOnce(`<title>${'T'.repeat(2000)}</title><script type="application/ld+json">${JSON.stringify(schema)}</script><body>No address</body>`);
    const response = await user(request(app).post('/api/scan-url')).send({ url: 'https://example.test' }).expect(200);
    expect(response.body.title).toHaveLength(500);
    for (const key of ['address', 'city', 'state', 'zipCode']) expect(response.body[key]).toBe('');
  });
  test('scan handles long nonmatching text without unbounded address or hours searches', async () => {
    fetchPublicHtml.mockResolvedValueOnce(`<body>${'Open Monday '.repeat(180000)}</body>`);
    const response = await user(request(app).post('/api/scan-url')).send({ url: 'https://example.test' }).expect(200);
    expect(response.body.address).toBe('');
    expect(response.body.hours).toBe('');
  });
});
