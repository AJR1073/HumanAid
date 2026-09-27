const guard = require('../scripts/maintenance-guard');
const { main } = require('../scripts/verify_resolve_hosting');
const { main: checkSchema } = require('../scripts/check_schema');
const { main: clearActivityLog } = require('../scripts/clear_production_logs');
const { main: readActivityLog } = require('../scripts/read_production_logs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const local = { ALLOW_DATABASE_MAINTENANCE: 'true', DB_HOST: '127.0.0.1', DB_USER: 'test_operator', DB_NAME: 'test_db', DB_PASSWORD: 'test-only-placeholder' };
test('maintenance scripts require explicit approval and complete configuration', () => {
    expect(() => guard({})).toThrow('disabled');
    expect(() => guard({ ...local, DB_PASSWORD: '' })).toThrow('DB_PASSWORD');
    expect(() => guard(local)).not.toThrow();
});
test('remote maintenance requires verified TLS and an explicit remote opt-in', () => {
    expect(() => guard({ ...local, DB_HOST: 'staging.example.org' })).toThrow('Remote maintenance');
    expect(() => guard({ ...local, DB_HOST: 'staging.example.org', ALLOW_REMOTE_DATABASE: 'true', DB_SSL: 'true' })).not.toThrow();
    expect(() => guard({ ...local, NODE_ENV: 'production' })).toThrow('Production maintenance requires DB_SSL=true');
    expect(() => guard({ ...local, NODE_ENV: 'production', DB_SSL: 'true' })).not.toThrow();
});

test('destructive log cleanup requires its own explicit approval before opening a pool', async () => {
    const createPool = jest.fn();
    await expect(clearActivityLog({ env: local, createPool })).rejects.toThrow('ALLOW_CLEAR_ACTIVITY_LOG=true');
    expect(createPool).not.toHaveBeenCalled();
});

test('database inspection helpers require approval before opening pools', async () => {
    const createPool = jest.fn();
    await expect(checkSchema({ env: {}, createPool })).rejects.toThrow('disabled');
    await expect(readActivityLog({ env: {}, createPool })).rejects.toThrow('disabled');
    expect(createPool).not.toHaveBeenCalled();
});

test('database maintenance helpers end their pools on success and failure', async () => {
    const schemaPool = {
        query: jest.fn().mockResolvedValue({ rows: [{ table_name: 'resources' }] }),
        end: jest.fn().mockResolvedValue(undefined)
    };
    await expect(checkSchema({ env: local, createPool: () => schemaPool })).resolves.toEqual(['resources']);
    expect(schemaPool.end).toHaveBeenCalledTimes(1);

    const readPool = {
        query: jest.fn().mockResolvedValue({ rows: [{ total_count: '4' }] }),
        end: jest.fn().mockResolvedValue(undefined)
    };
    await expect(readActivityLog({ env: local, createPool: () => readPool })).resolves.toBe(4);
    expect(readPool.end).toHaveBeenCalledTimes(1);

    const clearPool = {
        query: jest.fn().mockResolvedValue({ rowCount: 3 }),
        end: jest.fn().mockResolvedValue(undefined)
    };
    await expect(clearActivityLog({ env: { ...local, ALLOW_CLEAR_ACTIVITY_LOG: 'true' }, createPool: () => clearPool })).resolves.toBe(3);
    expect(clearPool.query).toHaveBeenCalledWith('DELETE FROM activity_log');
    expect(clearPool.end).toHaveBeenCalledTimes(1);

    const failedPool = {
        query: jest.fn().mockRejectedValue(new Error('synthetic-private-diagnostic')),
        end: jest.fn().mockResolvedValue(undefined)
    };
    await expect(checkSchema({ env: local, createPool: () => failedPool })).rejects.toThrow('Schema inspection failed');
    expect(failedPool.end).toHaveBeenCalledTimes(1);
});

test.each([
    'force_admin_insert.js', 'promote_admin.js', 'check_schema.js', 'clear_production_logs.js',
    'read_production_logs.js', 'verify_resolve_hosting.js'
])('%s does not execute operations or load dotenv merely by import', (scriptName) => {
    const scriptPath = path.resolve(__dirname, '../scripts', scriptName);
    const loader = `
      const Module = require('node:module');
      const original = Module._load;
      Module._load = function(request, parent, isMain) {
        if (request === 'pg') return { Pool: function() { throw new Error('pool created during import'); } };
        if (request === 'dotenv') return { config() { throw new Error('dotenv loaded during import'); } };
        return original.call(this, request, parent, isMain);
      };
      require(process.argv[1]);
    `;
    const result = spawnSync(process.execPath, ['-e', loader, scriptPath], {
        env: {
            NODE_ENV: 'test', ALLOW_DATABASE_MAINTENANCE: 'true', ALLOW_ADMIN_BOOTSTRAP: 'true',
            DB_HOST: '127.0.0.1', DB_USER: 'test', DB_NAME: 'test', DB_PASSWORD: 'placeholder'
        },
        encoding: 'utf8',
        timeout: 3000
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
});
test('report verification cannot target production and never sends a request by default', async () => {
    const request = jest.fn();
    await expect(main({}, request)).rejects.toThrow('approval');
    await expect(main({ ALLOW_REPORT_MUTATION: 'true', HUMANAID_TEST_API_URL: 'https://gocasino-1ecc9.web.app/api' }, request)).rejects.toThrow('production');
    await expect(main({ ALLOW_REPORT_MUTATION: 'true', HUMANAID_TEST_API_URL: 'https://gocasino-1ecc9.web.app./api' }, request)).rejects.toThrow('production');
    await expect(main({ ALLOW_REPORT_MUTATION: 'true', HUMANAID_TEST_API_URL: 'https://humanaidapp.org/api' }, request)).rejects.toThrow('production');
    expect(request).not.toHaveBeenCalled();
});
test('approved staging verification carries a token, bounded timeout and no redirects', async () => {
    const request = jest.fn().mockResolvedValue({ ok: true });
    await expect(main({ ALLOW_REPORT_MUTATION: 'true', HUMANAID_TEST_API_URL: 'http://localhost:4000/api', REPORT_ID: '3', FIREBASE_ID_TOKEN: 'test-admin-token' }, request)).resolves.toBe(true);
    expect(request).toHaveBeenCalledWith('http://localhost:4000/api/admin/reports/3/resolve', expect.objectContaining({ redirect: 'error', headers: expect.objectContaining({ Authorization: 'Bearer test-admin-token' }) }));
});
