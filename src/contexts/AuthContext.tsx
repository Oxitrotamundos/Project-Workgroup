import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  type User as FirebaseUser
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
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

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLoader, setShowLoader] = useState(true);

  // Convertir el usuario de Firebase a nuestro tipo User
  const createUserDocument = async (firebaseUser: FirebaseUser): Promise<User> => {
    const userRef = doc(db, 'users', firebaseUser.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const userData = userSnap.data();
      return {
        id: firebaseUser.uid,
        uid: firebaseUser.uid,
        email: firebaseUser.email!,
        displayName: userData.displayName || firebaseUser.displayName || '',
        role: userData.role || 'member',
        avatar: userData.avatar || firebaseUser.photoURL || undefined,
        createdAt: userData.createdAt?.toDate() || new Date()
      };
    } else {
      // Crear nuevo documento de usuario
      const newUser: User = {
        id: firebaseUser.uid,
        uid: firebaseUser.uid,
        email: firebaseUser.email!,
        displayName: firebaseUser.displayName || '',
        role: 'member',
        avatar: firebaseUser.photoURL || undefined,
        createdAt: new Date()
      };

      const userDocData: any = {
        displayName: newUser.displayName,
        role: newUser.role,
        createdAt: newUser.createdAt
      };

      // Solo agregar avatar si existe
      if (newUser.avatar) {
        userDocData.avatar = newUser.avatar;
      }

      await setDoc(userRef, userDocData);

      return newUser;
    }
  };

  const signIn = async (email: string, password: string): Promise<void> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  };

  const signUp = async (email: string, password: string, displayName: string): Promise<void> => {
    try {
      const { user: firebaseUser } = await createUserWithEmailAndPassword(auth, email, password);
      
      // Actualizar el nombre de usuario
      await updateProfile(firebaseUser, { displayName });
      
      // Crear el documento del usuario en Firestore
      await createUserDocument(firebaseUser);
    } catch (error) {
      console.error('Error signing up:', error);
      throw error;
    }
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

  const resetPassword = async (email: string): Promise<void> => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error('Error resetting password:', error);
      throw error;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const userData = await createUserDocument(firebaseUser);
          setUser(userData);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Error in auth state change:', error);
        setUser(null);
      } finally {
        // Asegurar que loading se ponga false
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  // Alias para logout
  const logout = signOut;

  const value: AuthContextType = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    logout,
    resetPassword
  };

  // Callback para cuando termine la animación del loader
  const handleLoaderComplete = useCallback(() => {
    setShowLoader(false);
  }, []);

  // Mostrar loader mientras se verifica el estado de autenticación o durante la animación
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