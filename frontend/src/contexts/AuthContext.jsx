// Authentication Context for HumanAid
import { createContext, useContext, useState, useEffect } from 'react';
import {
  auth,
  onAuthStateChanged,
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  logOut
} from '../firebase';
const API_BASE = import.meta.env.VITE_API_URL || '/api';

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

  // Sync User to Backend
  const syncUser = async (user) => {
    if (!user) return;
    try {
      console.log('Syncing user to:', `${API_BASE}/users/sync`);
      const res = await fetch(`${API_BASE}/users/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL
        })
      });
      console.log('Sync response status:', res.status);
      if (!res.ok) throw new Error(`Sync failed: ${res.statusText}`);

      const data = await res.json();
      console.log('Sync response data:', data);
      if (data.isAdmin) setIsAdmin(true);
    } catch (err) {
      console.error('User sync failed:', err);
    }
  };

  // Fetch Favorites
  const fetchFavorites = async (uid) => {
    if (!uid) return;
    try {
      const res = await fetch(`${API_BASE}/favorites?uid=${uid}`);
      const data = await res.json();
      if (data.favorites) setFavorites(data.favorites);
    } catch (err) {
      console.error('Fetch favorites failed:', err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // Sync user and fetch favorites
        await syncUser(user);
        await fetchFavorites(user.uid);
      } else {
        setFavorites([]);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const toggleFavorite = async (resourceId) => {
    if (!user) return false;

    // Optimistic Update
    const isFav = favorites.includes(resourceId);
    const newFavs = isFav ? favorites.filter(id => id !== resourceId) : [...favorites, resourceId];
    setFavorites(newFavs);

    try {
      await fetch(`${API_BASE}/favorites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, resourceId })
      });
      return !isFav;
    } catch (err) {
      console.error('Toggle favorite failed:', err);
      // Revert on error
      setFavorites(favorites);
      return isFav; // Return original state
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
