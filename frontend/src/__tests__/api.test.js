import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, API_BASE } from '../api';
import { auth } from '../firebase';

describe('HumanAid API identity', () => {
  beforeEach(() => {
    auth.currentUser = null;
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
  });

  it('obtains the current Firebase ID token for each API request', async () => {
    const getIdToken = vi.fn().mockResolvedValueOnce('test-token-one').mockResolvedValueOnce('test-token-two');
    auth.currentUser = { getIdToken };
    await apiFetch(`${API_BASE}/favorites`);
    await apiFetch(`${API_BASE}/favorites`);
    expect(getIdToken).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer test-token-one');
    expect(fetch.mock.calls[1][1].headers.get('Authorization')).toBe('Bearer test-token-two');
    expect(fetch.mock.calls[0][1].redirect).toBe('error');
  });

  it('does not accept a caller-supplied identity header for anonymous requests', async () => {
    await apiFetch(`${API_BASE}/resources/1/reports`, { headers: { Authorization: 'Bearer forged-test-token' } });
    expect(fetch.mock.calls[0][1].headers.has('Authorization')).toBe(false);
  });

  it.each(['https://example.net/api/favorites', '/api-other/favorites', '//example.net/api', '/api/../private'])('never sends tokens outside its API boundary: %s', async url => {
    auth.currentUser = { getIdToken: vi.fn().mockResolvedValue('test-token') };
    await expect(apiFetch(url)).rejects.toThrow('HumanAid API');
    expect(auth.currentUser.getIdToken).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not fall back to an unauthenticated request when token refresh fails', async () => {
    auth.currentUser = { getIdToken: vi.fn().mockRejectedValue(new Error('expired test session')) };
    await expect(apiFetch(`${API_BASE}/admin/list`)).rejects.toThrow('expired test session');
    expect(fetch).not.toHaveBeenCalled();
  });
});
