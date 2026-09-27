import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { auth, onAuthStateChanged } from '../firebase';
let notify;
const identity = (uid) => ({ uid, email: `${uid}@example.test`, displayName: uid, photoURL: null, getIdToken: vi.fn().mockResolvedValue(`test-token-${uid}`) });
const response = data => ({ ok: true, json: async () => data });
function Consumer() {
  const { user, isAdmin, favorites, toggleFavorite, error } = useAuth();
  return <><div data-testid="account">{user?.uid || 'guest'}:{String(isAdmin)}</div><div data-testid="favorites">{favorites.join(',')}</div><div>{error}</div><button onClick={() => toggleFavorite(7)}>Toggle favorite</button></>;
}
beforeEach(() => {
  auth.currentUser = null;
  onAuthStateChanged.mockImplementation((_auth, callback) => { notify = callback; return vi.fn(); });
  global.fetch = vi.fn(async url => response(url.endsWith('/favorites') ? { favorites: [7] } : { isAdmin: false }));
});
describe('authenticated account actions', () => {
  it('syncs and loads favorites using the verified-token contract, without browser identity fields', async () => {
    render(<AuthProvider><Consumer /></AuthProvider>);
    await act(async () => { await notify(identity('alice')); });
    expect(screen.getByTestId('account')).toHaveTextContent('alice:false');
    expect(screen.getByTestId('favorites')).toHaveTextContent('7');
    const [url, options] = fetch.mock.calls.find(([path]) => path.endsWith('/users/sync'));
    expect(url).toContain('/api/users/sync');
    expect(JSON.parse(options.body)).toEqual({ displayName: 'alice', photoURL: null });
    for (const [path, config] of fetch.mock.calls) {
      expect(path).not.toContain('uid=');
      expect(config.headers.get('Authorization')).toBe('Bearer test-token-alice');
    }
  });
  it('rolls back favorites on an HTTP rejection and sends no UID in the mutation', async () => {
    render(<AuthProvider><Consumer /></AuthProvider>);
    await act(async () => { await notify(identity('alice')); });
    fetch.mockResolvedValueOnce({ ok: false });
    fireEvent.click(screen.getByRole('button', { name: 'Toggle favorite' }));
    await waitFor(() => expect(screen.getByText(/Could not update/)).toBeInTheDocument());
    expect(screen.getByTestId('favorites')).toHaveTextContent('7');
    const [, options] = fetch.mock.calls.at(-1);
    expect(JSON.parse(options.body)).toEqual({ resourceId: 7 });
  });
  it('clears old admin authority on account changes and sign-out', async () => {
    fetch.mockImplementation(async (url, options) => response(url.endsWith('/favorites') ? { favorites: [] } : { isAdmin: options.headers.get('Authorization').endsWith('alice') }));
    render(<AuthProvider><Consumer /></AuthProvider>);
    await act(async () => { await notify(identity('alice')); });
    expect(screen.getByTestId('account')).toHaveTextContent('alice:true');
    await act(async () => { await notify(identity('bob')); });
    expect(screen.getByTestId('account')).toHaveTextContent('bob:false');
    await act(async () => { await notify(null); });
    expect(screen.getByTestId('account')).toHaveTextContent('guest:false');
  });
});
