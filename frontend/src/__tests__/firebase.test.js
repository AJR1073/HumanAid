import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => {
  const app = { name: 'synthetic-app' };
  const auth = { currentUser: null };
  const db = { name: 'synthetic-database' };
  return {
    app, auth, db,
    initializeApp: vi.fn(() => app),
    getAuth: vi.fn(() => auth),
    getFirestore: vi.fn(() => db),
    GoogleAuthProvider: vi.fn(function GoogleAuthProvider() {}),
    signInWithPopup: vi.fn(),
    signInWithEmailAndPassword: vi.fn(),
    createUserWithEmailAndPassword: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChanged: vi.fn(),
    updateProfile: vi.fn(),
    sendEmailVerification: vi.fn()
  };
});
vi.mock('firebase/app', () => ({ initializeApp: sdk.initializeApp }));
vi.mock('firebase/auth', () => ({
  getAuth: sdk.getAuth,
  GoogleAuthProvider: sdk.GoogleAuthProvider,
  signInWithPopup: sdk.signInWithPopup,
  signInWithEmailAndPassword: sdk.signInWithEmailAndPassword,
  createUserWithEmailAndPassword: sdk.createUserWithEmailAndPassword,
  signOut: sdk.signOut,
  onAuthStateChanged: sdk.onAuthStateChanged,
  updateProfile: sdk.updateProfile,
  sendEmailVerification: sdk.sendEmailVerification
}));
vi.mock('firebase/firestore', () => ({ getFirestore: sdk.getFirestore }));

// These are synthetic fixtures, never values from a local .env or real project.
const required = {
  VITE_FIREBASE_API_KEY: 'synthetic-browser-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'synthetic-project.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'synthetic-project',
  VITE_FIREBASE_APP_ID: 'synthetic-app-id'
};
const optional = {
  VITE_FIREBASE_STORAGE_BUCKET: 'synthetic-project.firebasestorage.app',
  VITE_FIREBASE_MESSAGING_SENDER_ID: 'synthetic-sender',
  VITE_FIREBASE_DATABASE_URL: 'https://synthetic-project.firebaseio.com',
  VITE_FIREBASE_MEASUREMENT_ID: 'synthetic-measurement'
};
const configure = (values = required) => {
  for (const [variable, value] of Object.entries(values)) vi.stubEnv(variable, value);
};
const loadFirebase = () => import('../firebase');

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  // Exercise the actual module instead of the application's global unit-test mock.
  vi.doUnmock('../firebase');
  for (const variable of [...Object.keys(required), ...Object.keys(optional)]) {
    vi.stubEnv(variable, undefined);
  }
  sdk.auth.currentUser = null;
});
afterEach(() => vi.unstubAllEnvs());

describe('explicit Firebase environment configuration', () => {
  it('rejects absent configuration without falling back to any project', async () => {
    await expect(loadFirebase()).rejects.toThrow('Missing Firebase client configuration: VITE_FIREBASE_API_KEY');
    expect(sdk.initializeApp).not.toHaveBeenCalled();
    expect(sdk.getAuth).not.toHaveBeenCalled();
    expect(sdk.getFirestore).not.toHaveBeenCalled();
  });

  it.each(Object.keys(required))('rejects incomplete configuration missing %s', async variable => {
    configure();
    vi.stubEnv(variable, undefined);
    await expect(loadFirebase()).rejects.toThrow(`Missing Firebase client configuration: ${variable}`);
    expect(sdk.initializeApp).not.toHaveBeenCalled();
  });

  it.each(['   ', 'your_api_key_here', '<project-value>', '${UNSET_VALUE}', 'replace-me', 'change_me', 'undefined', 'null', 'synthetic value', 'synthetic\u0007value'])('rejects blank or invalid configuration without echoing it: %j', async value => {
    configure();
    vi.stubEnv('VITE_FIREBASE_API_KEY', value);
    const failure = await loadFirebase().catch(error => error);
    expect(failure).toBeInstanceOf(Error);
    expect(failure.message).toMatch(/(?:Missing|Invalid) Firebase client configuration: VITE_FIREBASE_API_KEY/);
    expect(failure.message).not.toContain(value);
    expect(sdk.initializeApp).not.toHaveBeenCalled();
  });

  it('passes trimmed required fields to the SDK and omits absent optional fields', async () => {
    configure(Object.fromEntries(Object.entries(required).map(([variable, value]) => [variable, `  ${value}\n`])));
    vi.stubEnv('VITE_FIREBASE_STORAGE_BUCKET', ' \t ');
    const firebase = await loadFirebase();
    expect(sdk.initializeApp).toHaveBeenCalledExactlyOnceWith({
      apiKey: required.VITE_FIREBASE_API_KEY,
      authDomain: required.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: required.VITE_FIREBASE_PROJECT_ID,
      appId: required.VITE_FIREBASE_APP_ID
    });
    expect(firebase.auth).toBe(sdk.auth);
    expect(firebase.db).toBe(sdk.db);
    expect(firebase.googleProvider).toBeInstanceOf(sdk.GoogleAuthProvider);
    expect(firebase.onAuthStateChanged).toBe(sdk.onAuthStateChanged);
    expect(sdk.getAuth).toHaveBeenCalledWith(sdk.app);
    expect(sdk.getFirestore).toHaveBeenCalledWith(sdk.app);
    expect(Object.keys(firebase).sort()).toEqual([
      'auth', 'db', 'googleProvider', 'logOut', 'onAuthStateChanged',
      'requestEmailVerification', 'signInWithEmail', 'signInWithGoogle', 'signUpWithEmail'
    ].sort());
  });

  it('passes all explicitly configured optional fields without adding defaults', async () => {
    configure();
    configure(Object.fromEntries(Object.entries(optional).map(([variable, value]) => [variable, ` ${value} `])));
    await loadFirebase();
    expect(sdk.initializeApp).toHaveBeenCalledExactlyOnceWith({
      apiKey: required.VITE_FIREBASE_API_KEY,
      authDomain: required.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: required.VITE_FIREBASE_PROJECT_ID,
      appId: required.VITE_FIREBASE_APP_ID,
      storageBucket: optional.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: optional.VITE_FIREBASE_MESSAGING_SENDER_ID,
      databaseURL: optional.VITE_FIREBASE_DATABASE_URL,
      measurementId: optional.VITE_FIREBASE_MEASUREMENT_ID
    });
  });

  it('rejects configured optional placeholders before initialization', async () => {
    configure();
    vi.stubEnv('VITE_FIREBASE_DATABASE_URL', 'your_database_url');
    await expect(loadFirebase()).rejects.toThrow('Invalid Firebase client configuration: VITE_FIREBASE_DATABASE_URL');
    expect(sdk.initializeApp).not.toHaveBeenCalled();
  });
});

describe('existing Firebase helper contracts', () => {
  beforeEach(() => configure());

  it('preserves Google sign-in, email sign-in, registration, verification, and logout', async () => {
    const firebase = await loadFirebase();
    const user = { uid: 'synthetic-user' };
    sdk.auth.currentUser = user;
    sdk.signInWithPopup.mockResolvedValueOnce({ user });
    sdk.signInWithEmailAndPassword.mockResolvedValueOnce({ user });
    sdk.createUserWithEmailAndPassword.mockResolvedValueOnce({ user });

    await expect(firebase.signInWithGoogle()).resolves.toEqual({ user, error: null });
    expect(sdk.signInWithPopup).toHaveBeenCalledWith(sdk.auth, firebase.googleProvider);
    await expect(firebase.signInWithEmail('member@example.test', 'synthetic-password')).resolves.toEqual({ user, error: null });
    expect(sdk.signInWithEmailAndPassword).toHaveBeenCalledWith(sdk.auth, 'member@example.test', 'synthetic-password');
    await expect(firebase.signUpWithEmail('member@example.test', 'synthetic-password', 'Member')).resolves.toEqual({ user, error: null });
    expect(sdk.createUserWithEmailAndPassword).toHaveBeenCalledWith(sdk.auth, 'member@example.test', 'synthetic-password');
    expect(sdk.updateProfile).toHaveBeenCalledWith(user, { displayName: 'Member' });
    await expect(firebase.requestEmailVerification()).resolves.toEqual({ error: null });
    expect(sdk.sendEmailVerification).toHaveBeenCalledWith(user);
    await expect(firebase.logOut()).resolves.toEqual({ error: null });
    expect(sdk.signOut).toHaveBeenCalledWith(sdk.auth);
  });

  it('preserves safe errors for email sign-in, registration, and verification', async () => {
    const firebase = await loadFirebase();
    sdk.signInWithEmailAndPassword.mockRejectedValueOnce({ code: 'auth/wrong-password' });
    sdk.createUserWithEmailAndPassword.mockRejectedValueOnce({ code: 'auth/email-already-in-use' });
    await expect(firebase.signInWithEmail('member@example.test', 'synthetic-password')).resolves.toEqual({ user: null, error: 'Incorrect password' });
    await expect(firebase.signUpWithEmail('member@example.test', 'synthetic-password')).resolves.toEqual({ user: null, error: 'An account with this email already exists' });
    await expect(firebase.requestEmailVerification()).resolves.toEqual({ error: 'Sign in first.' });
    expect(sdk.sendEmailVerification).not.toHaveBeenCalled();
    sdk.auth.currentUser = { uid: 'synthetic-user' };
    sdk.sendEmailVerification.mockRejectedValueOnce(new Error('synthetic-internal-detail'));
    await expect(firebase.requestEmailVerification()).resolves.toEqual({ error: 'Could not send the verification email. Please try again later.' });
  });
});
