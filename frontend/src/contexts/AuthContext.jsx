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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

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
    isAdmin: user?.email === 'admin@humanaid.org' || user?.email?.endsWith('@humanaid.org')
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
