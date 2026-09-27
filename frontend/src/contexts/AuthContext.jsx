// Authentication Context for HumanAid
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  auth,
  onAuthStateChanged,
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  logOut,
  requestEmailVerification
} from '../firebase';
import { apiFetch, API_BASE } from '../api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [favorites, setFavorites] = useState([]);

  const authRevision = useRef(0);
  const pendingFavorites = useRef(new Set());

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      const revision = ++authRevision.current;
      setUser(currentUser);
      setLoading(true);
      setFavorites([]);
      setIsAdmin(false);
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        const [profileResponse, favoritesResponse] = await Promise.all([
          apiFetch(`${API_BASE}/users/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL
            })
          }, currentUser),
          apiFetch(`${API_BASE}/favorites`, {}, currentUser)
        ]);
        if (!profileResponse.ok || !favoritesResponse.ok) throw new Error('Account sync failed.');
        const [profile, saved] = await Promise.all([profileResponse.json(), favoritesResponse.json()]);
        if (active && revision === authRevision.current) {
          setIsAdmin(profile.isAdmin === true);
          setFavorites((saved.favorites || []).map(Number));
        }
      } catch {
        if (active && revision === authRevision.current) setError('Could not load your account. Please sign in again.');
      } finally {
        if (active && revision === authRevision.current) setLoading(false);
      }
    });
    return () => { active = false; authRevision.current += 1; unsubscribe(); };
  }, []);

  const toggleFavorite = async (resourceId) => {
    const id = Number(resourceId);
    if (!user || !Number.isSafeInteger(id) || id < 1 || pendingFavorites.current.has(id)) return false;
    const revision = authRevision.current;
    const isFav = favorites.includes(id);
    pendingFavorites.current.add(id);
    setFavorites(previous => isFav ? previous.filter(saved => saved !== id) : [...previous, id]);
    try {
      const response = await apiFetch(`${API_BASE}/favorites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceId: id })
      }, user);
      if (!response.ok) throw new Error('Favorite update failed.');
      return !isFav;
    } catch {
      if (revision === authRevision.current) {
        setFavorites(previous => isFav ? [...new Set([...previous, id])] : previous.filter(saved => saved !== id));
        setError('Could not update your saved resources. Please try again.');
      }
      return isFav;
    } finally {
      pendingFavorites.current.delete(id);
    }
  };

  const loginWithGoogle = async () => {
    setError(null);
    const result = await signInWithGoogle();
    if (result.error) {
      setError(result.error);
    }
    return result;
  };

  const loginWithEmail = async (email, password) => {
    setError(null);
    const result = await signInWithEmail(email, password);
    if (result.error) {
      setError(result.error);
    }
    return result;
  };

  const register = async (email, password, displayName) => {
    setError(null);
    const result = await signUpWithEmail(email, password, displayName);
    if (result.error) {
      setError(result.error);
    }
    return result;
  };

  const logout = async () => {
    setError(null);
    const result = await logOut();
    if (result.error) {
      setError(result.error);
    }
    return result;
  };

  const clearError = () => setError(null);

  const value = {
    user,
    loading,
    error,
    loginWithGoogle,
    loginWithEmail,
    register,
    logout,
    verifyEmail: requestEmailVerification,
    clearError,
    isAuthenticated: !!user,
    isAdmin, // Now real state
    favorites,
    toggleFavorite
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
