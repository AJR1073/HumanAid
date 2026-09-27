const { main } = require('../scripts/promote_admin');
const { main: retiredBootstrap } = require('../scripts/force_admin_insert');
const { spawnSync } = require('node:child_process');

const local = {
  ALLOW_ADMIN_BOOTSTRAP: 'true',
  ALLOW_DATABASE_MAINTENANCE: 'true',
  DB_HOST: '127.0.0.1',
  DB_USER: 'test_operator',
  DB_NAME: 'test_db',
  DB_PASSWORD: 'test-only-placeholder'
};

function fixture(env = {}) {
  const pool = {
    query: jest.fn().mockResolvedValue({ rowCount: 1 }),
    end: jest.fn().mockResolvedValue(undefined)
  };
  const getUser = jest.fn().mockResolvedValue({
    uid: 'fixture-uid', email: 'Owner@Example.test', emailVerified: true, disabled: false
  });
  const options = { env: { ...local, ...env }, uid: 'fixture-uid', getUser, createPool: jest.fn(() => pool) };
  return { options, pool, getUser };
}

describe('Administrator bootstrap safeguards', () => {
  test('retired fabricated-UID bootstrap cannot promote an administrator', () => {
    expect(() => retiredBootstrap()).toThrow('retired');
  });

  test('CLI without approval exits safely without loading local configuration or contacting services', () => {
    const result = spawnSync(process.execPath, [require.resolve('../scripts/promote_admin')], {
      env: { NODE_ENV: 'test' },
      encoding: 'utf8',
      timeout: 3000
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('Admin bootstrap failed. Verify explicit operator approval, account identity and configuration.\n');
    expect(result.stderr).not.toContain('ReferenceError');
  });

  test.each([
    [{ ALLOW_ADMIN_BOOTSTRAP: undefined }, 'ALLOW_ADMIN_BOOTSTRAP'],
    [{ ALLOW_DATABASE_MAINTENANCE: undefined }, 'disabled'],
    [{ DB_PASSWORD: undefined }, 'DB_PASSWORD'],
    [{ DB_HOST: 'staging.example.test' }, 'Remote maintenance'],
    [{ DB_HOST: 'staging.example.test', ALLOW_REMOTE_DATABASE: 'true' }, 'Remote maintenance'],
    [{ DB_HOST: 'staging.example.test', DB_SSL: 'true' }, 'Remote maintenance'],
    [{ FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' }, 'emulator'],
    [{ DB_PORT: 'invalid' }, 'DB_PORT']
  ])('rejects unsafe configuration before external access: %j', async (env, message) => {
    const { options, getUser } = fixture(env);
    await expect(main(options)).rejects.toThrow(message);
    expect(getUser).not.toHaveBeenCalled();
    expect(options.createPool).not.toHaveBeenCalled();
  });

  test.each([
    { uid: 'different-uid' }, { disabled: true }, { disabled: undefined },
    { emailVerified: false }, { emailVerified: 'true' }, { email: undefined }, { email: ' ' }
  ])('rejects an unverified or mismatched identity before opening the database: %j', async (identity) => {
    const { options, getUser } = fixture();
    getUser.mockResolvedValueOnce({ uid: 'fixture-uid', email: 'owner@example.test', emailVerified: true, disabled: false, ...identity });
    await expect(main(options)).rejects.toThrow('Only enabled accounts');
    expect(options.createPool).not.toHaveBeenCalled();
  });

  test('binds promotion to the active synced UID and current verified email', async () => {
    const { options, pool, getUser } = fixture();
    await expect(main(options)).resolves.toBe(true);
    expect(getUser).toHaveBeenCalledWith('fixture-uid');
    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE users SET is_admin = TRUE WHERE firebase_uid = $1 AND is_active = TRUE AND LOWER(email) = $2 RETURNING id',
      ['fixture-uid', 'owner@example.test']
    );
    expect(pool.end).toHaveBeenCalledTimes(1);
  });

  test('explicitly approved remote bootstrap uses certificate verification and the configured CA', async () => {
    const { options } = fixture({ DB_HOST: 'staging.example.test', ALLOW_REMOTE_DATABASE: 'true', DB_SSL: 'true', DB_SSL_CA: 'synthetic-ca' });
    await main(options);
    expect(options.createPool).toHaveBeenCalledWith(expect.objectContaining({
      ssl: { rejectUnauthorized: true, ca: 'synthetic-ca' }
    }));
  });

  test('fails when the active synced identity does not match and closes the pool', async () => {
    const { options, pool } = fixture();
    pool.query.mockResolvedValueOnce({ rowCount: 0 });
    await expect(main(options)).rejects.toThrow('active user');
    expect(pool.end).toHaveBeenCalledTimes(1);
  });

  test('closes the pool if the database update fails', async () => {
    const { options, pool } = fixture();
    pool.query.mockRejectedValueOnce(new Error('synthetic-database-failure'));
    await expect(main(options)).rejects.toThrow('synthetic-database-failure');
    expect(pool.end).toHaveBeenCalledTimes(1);
  });
});
