import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type {
  User,
  CreateUserData,
  UpdateUserData
} from '../types/firestore';

const COLLECTION_NAME = 'users';

/**
 * Servicio para gestionar usuarios en Firestore
 */
export class UserService {
  /**
   * Crear o actualizar un usuario (usado después del registro)
   */
  static async createOrUpdateUser(uid: string, data: CreateUserData): Promise<void> {
    try {
      const userData = {
        ...data,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      const docRef = doc(db, COLLECTION_NAME, uid);
      await setDoc(docRef, userData, { merge: true });
    } catch (error) {
      console.error('Error creating/updating user:', error);
      throw new Error('Error al crear o actualizar el usuario');
    }
  }

  /**
   * Obtener un usuario por ID
   */
  static async getUser(uid: string): Promise<User | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        } as User;
      }

      return null;
    } catch (error) {
      console.error('Error getting user:', error);
      throw new Error('Error al obtener el usuario');
    }
  }

  /**
   * Actualizar un usuario
   */
  static async updateUser(uid: string, data: UpdateUserData): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, uid);
      const updateData = {
        ...data,
        updatedAt: Timestamp.now()
      };

      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error updating user:', error);
      throw new Error('Error al actualizar el usuario');
    }
  }

  /**
   * Buscar usuarios por email (para invitaciones)
   */
  static async searchUsersByEmail(email: string): Promise<User[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('email', '>=', email),
        where('email', '<=', email + '\uf8ff'),
        orderBy('email'),
        orderBy('displayName')
      );

      const querySnapshot = await getDocs(q);
      const users: User[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        users.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        } as User);
      });

      return users;
    } catch (error) {
      console.error('Error searching users:', error);
      throw new Error('Error al buscar usuarios');
    }
  }

  /**
   * Obtener múltiples usuarios por sus IDs
   */
  static async getUsersByIds(userIds: string[]): Promise<User[]> {
    try {
      if (userIds.length === 0) {
        return [];
      }

      // Firestore tiene un límite de 10 elementos en consultas 'in'
      const chunks = [];
      for (let i = 0; i < userIds.length; i += 10) {
        chunks.push(userIds.slice(i, i + 10));
      }

      const users: User[] = [];

      for (const chunk of chunks) {
        const q = query(
          collection(db, COLLECTION_NAME),
          where('__name__', 'in', chunk.map(id => doc(db, COLLECTION_NAME, id)))
        );

        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          users.push({
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date()
          } as User);
        });
      }

      return users;
    } catch (error) {
      console.error('Error getting users by IDs:', error);
      throw new Error('Error al obtener usuarios');
    }
  }

  /**
   * Verificar si un usuario existe
   */
  static async userExists(uid: string): Promise<boolean> {
    try {
      const user = await this.getUser(uid);
      return user !== null;
    } catch (error) {
      console.error('Error checking if user exists:', error);
      return false;
    }
  }

  /**
   * Obtener todos los usuarios (para administradores)
   */
  static async getAllUsers(): Promise<User[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        orderBy('displayName')
      );

      const querySnapshot = await getDocs(q);
      const users: User[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        users.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        } as User);
      });

      return users;
    } catch (error) {
      console.error('Error getting all users:', error);
      throw new Error('Error al obtener todos los usuarios');
    }
  }
}

export default UserService;