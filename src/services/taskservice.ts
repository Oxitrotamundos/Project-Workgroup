import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type {
  Task,
  CreateTaskData,
  UpdateTaskData,
  TaskFilters
} from '../types/firestore';

const COLLECTION_NAME = 'tasks';

/**
 * Servicio para gestionar tareas en Firestore
 */
export class TaskService {
  /**
   * Crear una nueva tarea
   */
  static async createTask(data: CreateTaskData): Promise<string> {
    try {
      // Verificar si Firebase está configurado
      if (!db) {
        throw new Error('Firebase no está configurado correctamente. Verifica el archivo .env');
      }

      const taskData = {
        ...data,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      const docRef = await addDoc(collection(db, COLLECTION_NAME), taskData);
      console.log('Tarea creada exitosamente con ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error creating task:', error);
      
      if (error instanceof Error) {
        // Si es un error de configuración de Firebase, mantener el mensaje original
        if (error.message.includes('Firebase') || error.message.includes('.env')) {
          throw error;
        }
        // Si es un error de permisos o conexión de Firebase
        if (error.message.includes('permission') || error.message.includes('PERMISSION_DENIED')) {
          throw new Error('Error de permisos en Firebase. Verifica las reglas de Firestore.');
        }
      }
      
      throw new Error('Error al crear la tarea');
    }
  }

  /**
   * Obtener una tarea por ID
   */
  static async getTask(id: string): Promise<Task | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          startDate: data.startDate?.toDate() || new Date(),
          endDate: data.endDate?.toDate() || new Date()
        } as Task;
      }

      return null;
    } catch (error) {
      console.error('Error getting task:', error);
      throw new Error('Error al obtener la tarea');
    }
  }

  /**
   * Obtener tareas de un proyecto
   */
  static async getProjectTasks(projectId: string, filters?: TaskFilters): Promise<Task[]> {
    try {
      let q = query(
        collection(db, COLLECTION_NAME),
        where('projectId', '==', projectId),
        orderBy('startDate', 'asc')
      );

      // Aplicar filtros adicionales
      if (filters?.status) {
        q = query(q, where('status', '==', filters.status));
      }

      if (filters?.assigneeId) {
        q = query(q, where('assigneeId', '==', filters.assigneeId));
      }

      if (filters?.priority) {
        q = query(q, where('priority', '==', filters.priority));
      }

      const snapshot = await getDocs(q);
      const tasks = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          startDate: data.startDate?.toDate() || new Date(),
          endDate: data.endDate?.toDate() || new Date()
        } as Task;
      });

      return tasks;
    } catch (error) {
      console.error('Error getting project tasks:', error);
      return [];
    }
  }

  /**
   * Actualizar una tarea
   */
  static async updateTask(id: string, data: UpdateTaskData): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const updateData = {
        ...data,
        updatedAt: Timestamp.now()
      };

      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error updating task:', error);
      throw new Error('Error al actualizar la tarea');
    }
  }

  /**
   * Eliminar una tarea
   */
  static async deleteTask(id: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting task:', error);
      throw new Error('Error al eliminar la tarea');
    }
  }

  /**
   * Obtener tareas asignadas a un usuario
   */
  static async getUserTasks(userId: string, filters?: TaskFilters): Promise<Task[]> {
    try {
      let q = query(
        collection(db, COLLECTION_NAME),
        where('assigneeId', '==', userId),
        orderBy('startDate', 'asc')
      );

      // Aplicar filtros adicionales
      if (filters?.status) {
        q = query(q, where('status', '==', filters.status));
      }

      if (filters?.projectId) {
        q = query(q, where('projectId', '==', filters.projectId));
      }

      const snapshot = await getDocs(q);
      const tasks = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          startDate: data.startDate?.toDate() || new Date(),
          endDate: data.endDate?.toDate() || new Date()
        } as Task;
      });

      return tasks;
    } catch (error) {
      console.error('Error getting user tasks:', error);
      return [];
    }
  }

  /**
   * Actualizar el progreso de una tarea
   */
  static async updateTaskProgress(id: string, progress: number): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        progress,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating task progress:', error);
      throw new Error('Error al actualizar el progreso de la tarea');
    }
  }

  /**
   * Agregar dependencia a una tarea
   */
  static async addTaskDependency(taskId: string, dependencyId: string): Promise<void> {
    try {
      const task = await this.getTask(taskId);
      if (!task) {
        throw new Error('Tarea no encontrada');
      }

      if (!task.dependencies.includes(dependencyId)) {
        const updatedDependencies = [...task.dependencies, dependencyId];
        await this.updateTask(taskId, { dependencies: updatedDependencies });
      }
    } catch (error) {
      console.error('Error adding task dependency:', error);
      throw new Error('Error al agregar dependencia a la tarea');
    }
  }

  /**
   * Remover dependencia de una tarea
   */
  static async removeTaskDependency(taskId: string, dependencyId: string): Promise<void> {
    try {
      const task = await this.getTask(taskId);
      if (!task) {
        throw new Error('Tarea no encontrada');
      }

      const updatedDependencies = task.dependencies.filter(id => id !== dependencyId);
      await this.updateTask(taskId, { dependencies: updatedDependencies });
    } catch (error) {
      console.error('Error removing task dependency:', error);
      throw new Error('Error al remover dependencia de la tarea');
    }
  }
}

export default TaskService;