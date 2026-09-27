const request = require('supertest');
const { app, db } = require('../../test/helpers');

test('public resource detail keeps directory and editor fields while withholding internal metadata', async () => {
  const directory = {
    id: 1, name: 'Synthetic Pantry', primary_category_id: 2,
    category_name: 'Food', address: '123 Example St', city: 'Example', state: 'IL',
    email: 'pantry@example.test', hours: 'By appointment',
    hours_of_operation: { monday: '09:00-12:00' },
    is_active: true, appointment_required: true, required_documents: ['ID'],
    languages_spoken: ['en'], service_area: 'Example County',
    eligibility_requirements: 'Call for eligibility',
    latitude: 0, longitude: 0, verified: false, verified_at: null
  };
  db.mockResolvedValueOnce({ rows: [{
    ...directory, submitted_by: 101, approved_by: 102, verified_by: 103,
    submitted_at: '2026-01-01', approved_at: '2026-01-02',
    approval_status: 'approved', quality_score: 9, view_count: 22,
    contact_count: 3, location: 'private-database-geometry',
    future_private_column: 'restricted'
  }] });

  const response = await request(app).get('/api/resources/1').expect(200);
  expect(response.body).toEqual(directory);
  expect(db.mock.calls[0][1]).toEqual(['1']);
});
