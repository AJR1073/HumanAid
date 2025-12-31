const request = require('supertest');

// Mock pg before requiring server
jest.mock('pg', () => {
    const mPool = {
        query: jest.fn(),
        end: jest.fn(),
        on: jest.fn(),
        connect: jest.fn(),
    };
    return { Pool: jest.fn(() => mPool) };
});

const { app } = require('../server');
const { Pool } = require('pg');

describe('Admin API Endpoints', () => {
    let pool;

    beforeAll(() => {
        pool = new Pool();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/admin/resources', () => {
        it('should return a list of resources', async () => {
            const mockResources = [
                { id: 1, name: 'Resource 1', zip_code: '62298' },
                { id: 2, name: 'Resource 2', zip_code: '62002' }
            ];
            // Mock pool.query for search
            // First call might be search, second count
            pool.query
                .mockResolvedValueOnce({ rows: mockResources }) // search results
                .mockResolvedValueOnce({ rows: [{ count: 2 }] }); // count

            const res = await request(app).get('/api/admin/resources?search=&missing_zip=false');

            expect(res.statusCode).toBe(200);
            expect(res.body.resources).toHaveLength(2);
            expect(res.body.resources[0].name).toBe('Resource 1');
            expect(pool.query).toHaveBeenCalledTimes(2);
        });

        it('should filter by missing zip', async () => {
            pool.query
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [{ count: 0 }] });

            const res = await request(app).get('/api/admin/resources?missing_zip=true');

            expect(res.statusCode).toBe(200);
            // Verify query contained NULL check
            const queryCall = pool.query.mock.calls[0][0];
            expect(queryCall).toContain('zip_code IS NULL');
        });
    });

    describe('PUT /api/admin/resources/:id', () => {
        it('should update resource successfully including email', async () => {
            const updateData = {
                name: 'Updated Name',
                address: '123 St',
                city: 'City',
                state: 'IL',
                zip_code: '12345',
                phone: '555-5555',
                email: 'updated@example.com',
                website: 'site.com',
                hours: '9-5',
                primary_category_id: 1,
                is_active: true,
                // New fields
                eligibility_requirements: 'Must be resident',
                appointment_required: true,
                walk_ins_accepted: false,
                food_dist_type: 'boxes',
                food_dist_onsite: true,
                service_area: 'Metro',
                languages_spoken: 'English'
            };

            pool.query.mockResolvedValueOnce({ rowCount: 1 });

            const res = await request(app)
                .put('/api/admin/resources/123')
                .send(updateData);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);

            // Verify new fields were passed to query
            const queryParams = pool.query.mock.calls[0][1];
            expect(queryParams).toContain('updated@example.com');
            expect(queryParams).toContain('Must be resident');
            expect(queryParams).toContain('boxes');
        });
    });
});
