// Firebase configuration for HumanAid
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendEmailVerification
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Browser configuration is public, but must be chosen explicitly for this environment.
// Never fall back to another Firebase project when configuration is incomplete.
const clientFields = {
  apiKey: ['VITE_FIREBASE_API_KEY', import.meta.env.VITE_FIREBASE_API_KEY, true],
  authDomain: ['VITE_FIREBASE_AUTH_DOMAIN', import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, true],
  projectId: ['VITE_FIREBASE_PROJECT_ID', import.meta.env.VITE_FIREBASE_PROJECT_ID, true],
  appId: ['VITE_FIREBASE_APP_ID', import.meta.env.VITE_FIREBASE_APP_ID, true],
  storageBucket: ['VITE_FIREBASE_STORAGE_BUCKET', import.meta.env.VITE_FIREBASE_STORAGE_BUCKET],
  messagingSenderId: ['VITE_FIREBASE_MESSAGING_SENDER_ID', import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID],
  databaseURL: ['VITE_FIREBASE_DATABASE_URL', import.meta.env.VITE_FIREBASE_DATABASE_URL],
  measurementId: ['VITE_FIREBASE_MEASUREMENT_ID', import.meta.env.VITE_FIREBASE_MEASUREMENT_ID]
};
const placeholder = /^(?:your[_-].*|replace[_-]?me|change[_-]?me|todo|undefined|null|<[^>]+>|\$\{[^}]+\})$/i;
const firebaseConfig = {};
for (const [field, [variable, raw, required]] of Object.entries(clientFields)) {
  const value = raw == null ? '' : typeof raw === 'string' ? raw.trim() : null;
  if (value === null || (value && (placeholder.test(value) || /\s|[\u0000-\u001f\u007f]/.test(value)))) {
    throw new Error(`Invalid Firebase client configuration: ${variable}. Use the value for your selected project.`);
  }
  if (!value) {
    if (required) {
      throw new Error(`Missing Firebase client configuration: ${variable}. Set all required VITE_FIREBASE_* variables.`);
    }
    continue;
  }
  firebaseConfig[field] = value;
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export const requestEmailVerification = async () => {
  if (!auth.currentUser) return { error: 'Sign in first.' };
  try {
    await sendEmailVerification(auth.currentUser);
    return { error: null };
  } catch {
    return { error: 'Could not send the verification email. Please try again later.' };
  }
};

// Auth helper functions
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return { user: result.user, error: null };
  } catch (error) {
    return { user: null, error: error.message };
  }
};

export const signInWithEmail = async (email, password) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return { user: result.user, error: null };
  } catch (error) {
    let errorMessage = 'Login failed';
    if (error.code === 'auth/user-not-found') {
      errorMessage = 'No account found with this email';
    } else if (error.code === 'auth/wrong-password') {
      errorMessage = 'Incorrect password';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Invalid email address';
    }
    return { user: null, error: errorMessage };
  }
};

export const signUpWithEmail = async (email, password, displayName) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(result.user, { displayName });
    }
    return { user: result.user, error: null };
  } catch (error) {
    let errorMessage = 'Registration failed';
    if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'An account with this email already exists';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'Password should be at least 6 characters';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Invalid email address';
    }
    return { user: null, error: errorMessage };
  }
};

export const logOut = async () => {
  try {
    await signOut(auth);
    return { error: null };
  } catch (error) {
    return { error: error.message };
  }
};

export { onAuthStateChanged };
