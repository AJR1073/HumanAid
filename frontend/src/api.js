import { auth } from './firebase';

export const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Send Firebase identity only to the configured HumanAid API, never map/data providers.
export async function apiFetch(input, options = {}, user = auth.currentUser) {
  const base = new URL(API_BASE, window.location.origin);
  const target = new URL(input, window.location.origin);
  const prefix = base.pathname.replace(/\/$/, '');
  if (!['http:', 'https:'].includes(target.protocol) || target.origin !== base.origin ||
      (target.pathname !== prefix && !target.pathname.startsWith(`${prefix}/`))) {
    throw new Error('Request must target the HumanAid API.');
  }

  const headers = new Headers(options.headers);
  headers.delete('Authorization');
  if (user) headers.set('Authorization', `Bearer ${await user.getIdToken()}`);
  return fetch(input, { ...options, headers, redirect: 'error', credentials: 'omit' });
}
