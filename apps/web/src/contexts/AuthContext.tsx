import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User as FirebaseUser
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { UserService } from '../services/userService';
import type { User, AuthContextType } from '../types';
import PageLoader from '../components/common/PageLoader';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

const mapFirebaseUser = (firebaseUser: FirebaseUser): User => ({
  id: firebaseUser.uid,
  uid: firebaseUser.uid,
  email: firebaseUser.email!,
  displayName: firebaseUser.displayName || '',
  role: 'member',
  avatar: firebaseUser.photoURL || undefined,
  createdAt: new Date()
});

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLoader, setShowLoader] = useState(true);

  const signIn = async (email: string, password: string): Promise<void> => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signInWithGoogle = async (): Promise<void> => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signUp = async (_email: string, _password: string, _displayName: string): Promise<void> => {
    throw new Error('Signup deshabilitado en esta versión.');
  };

  const signOut = async (): Promise<void> => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const resetPassword = async (_email: string): Promise<void> => {
    console.warn('resetPassword is not supported with Google-only auth');
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          try {
            await UserService.syncAfterLogin();
          } catch (err) {
            console.error('auth/sync failed', err);
          }
          setUser(mapFirebaseUser(firebaseUser));
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Error in auth state change:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const logout = signOut;

  const value: AuthContextType = {
    user,
    loading,
    signIn,
    signInWithGoogle,
    signUp,
    signOut,
    logout,
    resetPassword
  };

  const handleLoaderComplete = useCallback(() => {
    setShowLoader(false);
  }, []);

  if (loading || showLoader) {
    return (
      <PageLoader
        message="Verificando autenticación..."
        onAnimationComplete={!loading ? handleLoaderComplete : undefined}
      />
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
