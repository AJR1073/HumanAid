import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Unit/component tests must never contact a real Firebase project.
vi.mock('./firebase', () => ({
  auth: { currentUser: null },
  onAuthStateChanged: vi.fn((_auth, callback) => {
    queueMicrotask(() => callback(null));
    return vi.fn();
  }),
  signInWithGoogle: vi.fn(),
  signInWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
  requestEmailVerification: vi.fn(),
  logOut: vi.fn()
}));
