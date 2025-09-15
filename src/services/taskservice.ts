import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
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
  TaskFilters,
  TaskType
} from '../types/firestore';

const COLLECTION_NAME = 'tasks';

/**
 * Servicio para gestionar tareas en Firestore
 */
export class TaskService {
  /**
   * Obtener el próximo número de orden para un proyecto
   */
  static async getNextOrderForProject(projectId: string): Promise<number> {
    try {
      const tasks = await this.getProjectTasks(projectId);
      if (tasks.length === 0) {
        return 1;
      }
      
      const maxOrder = Math.max(...tasks.map(task => task.order || 0));
      return maxOrder + 1;
    } catch (error) {
      console.error('Error getting next order:', error);
      return 1;
    }
  }

  /**
   * Crear una nueva tarea
   */
  static async createTask(data: CreateTaskData): Promise<string> {
    try {
      // Verificar si Firebase está configurado
      if (!db) {
        throw new Error('Firebase no está configurado correctamente. Verifica el archivo .env');
      }

      // Obtener el próximo orden si no se proporciona
      let order = data.order;
      if (typeof order !== 'number') {
        order = await this.getNextOrderForProject(data.projectId);
      }

      const taskData = {
        ...data,
        order,
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
          open: data.open ?? true, // Default to expanded if not specified
          order: data.order || 0, // Orden por defecto para tareas existetentes sin un campo de orden
          type: data.type || 'task', // Tipo por defecto para tareas existentes sin campo de tipo
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
        orderBy('order', 'asc'),
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

      if (filters?.type) {
        q = query(q, where('type', '==', filters.type));
      }

      const snapshot = await getDocs(q);
      const tasks = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          open: data.open ?? true, // Default to expanded if not specified
          order: data.order || 0, // Orden por defecto para tareas existetentes sin un campo de orden
          type: data.type || 'task', // Tipo por defecto para tareas existentes sin campo de tipo
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
      
      // Filtrar campos undefined y manejar casos especiales antes de enviar a Firestore
      const cleanedData: any = {};
      Object.keys(data).forEach(key => {
        const value = (data as any)[key];
        if (value !== undefined) {
          // Caso especial: si parentId es null, usar deleteField() para eliminar el campo
          if (key === 'parentId' && value === null) {
            cleanedData[key] = deleteField();
          } else {
            cleanedData[key] = value;
          }
        }
      });
      
      const updateData = {
        ...cleanedData,
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
          open: data.open ?? true, // Default to expanded if not specified
          order: data.order || 0, // Orden por defecto para tareas existetentes sin un campo de orden
          type: data.type || 'task', // Tipo por defecto para tareas existentes sin campo de tipo
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

  /**
   * Obtener tareas por tipo
   */
  static async getTasksByType(projectId: string, type: TaskType): Promise<Task[]> {
    try {
      const filters: TaskFilters = { type };
      return await this.getProjectTasks(projectId, filters);
    } catch (error) {
      console.error('Error getting tasks by type:', error);
      return [];
    }
  }

  /**
   * Update task expand/collapse state
   */
  static async updateTaskExpandState(taskId: string, isOpen: boolean): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, taskId);
      await updateDoc(docRef, {
        open: isOpen,
        updatedAt: Timestamp.now()
      });
      console.log(`Task ${taskId} expand state updated to: ${isOpen}`);
    } catch (error) {
      console.error('Error updating task expand state:', error);
      throw new Error('Failed to update task expand state');
    }
  }

  /**
   * Actualizar orden de tareas después de mover una tarea
   */
  static async updateTaskOrder(projectId: string, movedTaskId: string, targetTaskId: string | null, mode: 'before' | 'after'): Promise<void> {
    try {
      const tasks = await this.getProjectTasks(projectId);
      const movedTask = tasks.find(t => t.id === movedTaskId);
      
      if (!movedTask) {
        throw new Error('Tarea a mover no encontrada');
      }

      // Si no hay target, mover al final
      if (!targetTaskId) {
        const maxOrder = Math.max(...tasks.map(t => t.order || 0));
        await this.updateTask(movedTaskId, { order: maxOrder + 1 });
        return;
      }

      const targetTask = tasks.find(t => t.id === targetTaskId);
      if (!targetTask) {
        throw new Error('Tarea objetivo no encontrada');
      }

      // Ordenar tareas por orden actual
      const sortedTasks = tasks.sort((a, b) => (a.order || 0) - (b.order || 0));
      const targetIndex = sortedTasks.findIndex(t => t.id === targetTaskId);
      
      let newOrder: number;
      
      if (mode === 'before') {
        if (targetIndex === 0) {
          // Insertar al principio
          newOrder = (targetTask.order || 1) / 2;
        } else {
          // Insertar entre la tarea anterior y la objetivo
          const prevTask = sortedTasks[targetIndex - 1];
          newOrder = ((prevTask.order || 0) + (targetTask.order || 0)) / 2;
        }
      } else {
        // mode === 'after'
        if (targetIndex === sortedTasks.length - 1) {
          // Insertar al final
          newOrder = (targetTask.order || 0) + 1;
        } else {
          // Insertar entre la objetivo y la siguiente
          const nextTask = sortedTasks[targetIndex + 1];
          newOrder = ((targetTask.order || 0) + (nextTask.order || 0)) / 2;
        }
      }

      await this.updateTask(movedTaskId, { order: newOrder });
      
    } catch (error) {
      console.error('Error updating task order:', error);
      throw new Error('Error al actualizar el orden de las tareas');
    }
  }
}

export default TaskService;