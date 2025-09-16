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
  Timestamp,
  writeBatch,
  limit
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type {
  TaskLink,
  CreateTaskLinkData,
  UpdateTaskLinkData,
  TaskLinkFilters
} from '../types/firestore';

const COLLECTION_NAME = 'task_links';

/**
 * Servicio para gestionar enlaces de dependencias entre tareas
 * Compatible con SVAR Gantt y arquitectura existente
 */
export class TaskLinkService {
  /**
   * Crear un nuevo enlace entre tareas
   */
  static async createLink(data: CreateTaskLinkData): Promise<string> {
    try {
      // Validar que Firebase está configurado
      if (!db) {
        throw new Error('Firebase no está configurado correctamente. Verifica el archivo .env');
      }

      // Validar que no sea un enlace circular (tarea a sí misma)
      if (data.sourceTaskId === data.targetTaskId) {
        throw new Error('No se puede crear un enlace de una tarea a sí misma');
      }

      // Verificar que el enlace no existe ya
      const existingLink = await this.findExistingLink(data.sourceTaskId, data.targetTaskId);
      if (existingLink) {
        throw new Error('Ya existe un enlace entre estas tareas');
      }

      // Verificar dependencias circulares
      const hasCircularDependency = await this.detectCircularDependency(
        data.sourceTaskId,
        data.targetTaskId,
        data.projectId
      );
      if (hasCircularDependency) {
        throw new Error('Este enlace crearía una dependencia circular');
      }

      const linkData = {
        ...data,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      const docRef = await addDoc(collection(db, COLLECTION_NAME), linkData);
      console.log('Enlace de tarea creado exitosamente con ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error creating task link:', error);

      if (error instanceof Error) {
        // Mantener mensajes de error específicos
        if (error.message.includes('Firebase') ||
            error.message.includes('circular') ||
            error.message.includes('enlace')) {
          throw error;
        }
        // Error de permisos
        if (error.message.includes('permission') || error.message.includes('PERMISSION_DENIED')) {
          throw new Error('Error de permisos en Firebase. Verifica las reglas de Firestore.');
        }
      }

      throw new Error('Error al crear el enlace de tarea');
    }
  }

  /**
   * Obtener un enlace por ID
   */
  static async getLink(id: string): Promise<TaskLink | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        } as TaskLink;
      }

      return null;
    } catch (error) {
      console.error('Error getting task link:', error);
      throw new Error('Error al obtener el enlace de tarea');
    }
  }

  /**
   * Obtener todos los enlaces de un proyecto
   */
  static async getProjectLinks(projectId: string, filters?: TaskLinkFilters): Promise<TaskLink[]> {
    try {
      let q = query(
        collection(db, COLLECTION_NAME),
        where('projectId', '==', projectId),
        orderBy('createdAt', 'asc')
      );

      // Aplicar filtros adicionales
      if (filters?.sourceTaskId) {
        q = query(q, where('sourceTaskId', '==', filters.sourceTaskId));
      }

      if (filters?.targetTaskId) {
        q = query(q, where('targetTaskId', '==', filters.targetTaskId));
      }

      if (filters?.type) {
        q = query(q, where('type', '==', filters.type));
      }

      const snapshot = await getDocs(q);
      const links = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        } as TaskLink;
      });

      return links;
    } catch (error) {
      console.error('Error getting project links:', error);
      return [];
    }
  }

  /**
   * Obtener enlaces donde la tarea es origen
   */
  static async getTaskSourceLinks(taskId: string): Promise<TaskLink[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('sourceTaskId', '==', taskId),
        orderBy('createdAt', 'asc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        } as TaskLink;
      });
    } catch (error) {
      console.error('Error getting task source links:', error);
      return [];
    }
  }

  /**
   * Obtener enlaces donde la tarea es destino
   */
  static async getTaskTargetLinks(taskId: string): Promise<TaskLink[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('targetTaskId', '==', taskId),
        orderBy('createdAt', 'asc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        } as TaskLink;
      });
    } catch (error) {
      console.error('Error getting task target links:', error);
      return [];
    }
  }

  /**
   * Actualizar un enlace
   */
  static async updateLink(id: string, data: UpdateTaskLinkData): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);

      const updateData = {
        ...data,
        updatedAt: Timestamp.now()
      };

      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error updating task link:', error);
      throw new Error('Error al actualizar el enlace de tarea');
    }
  }

  /**
   * Eliminar un enlace
   */
  static async deleteLink(id: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting task link:', error);
      throw new Error('Error al eliminar el enlace de tarea');
    }
  }

  /**
   * Eliminar todos los enlaces de una tarea (cuando se elimina la tarea)
   */
  static async deleteTaskLinks(taskId: string): Promise<void> {
    try {
      const batch = writeBatch(db);

      // Obtener enlaces donde la tarea es origen
      const sourceLinks = await this.getTaskSourceLinks(taskId);
      // Obtener enlaces donde la tarea es destino
      const targetLinks = await this.getTaskTargetLinks(taskId);

      // Agregar todas las eliminaciones al batch
      [...sourceLinks, ...targetLinks].forEach(link => {
        const docRef = doc(db, COLLECTION_NAME, link.id);
        batch.delete(docRef);
      });

      await batch.commit();
      console.log(`Enlaces eliminados para tarea ${taskId}:`, sourceLinks.length + targetLinks.length);
    } catch (error) {
      console.error('Error deleting task links:', error);
      throw new Error('Error al eliminar los enlaces de la tarea');
    }
  }

  /**
   * Buscar enlace existente entre dos tareas
   */
  private static async findExistingLink(sourceTaskId: string, targetTaskId: string): Promise<TaskLink | null> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('sourceTaskId', '==', sourceTaskId),
        where('targetTaskId', '==', targetTaskId),
        limit(1)
      );

      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      } as TaskLink;
    } catch (error) {
      console.error('Error finding existing link:', error);
      return null;
    }
  }

  /**
   * Detectar dependencias circulares usando DFS
   */
  private static async detectCircularDependency(
    sourceTaskId: string,
    targetTaskId: string,
    projectId: string
  ): Promise<boolean> {
    try {
      // Obtener todos los enlaces del proyecto para construir el grafo
      const allLinks = await this.getProjectLinks(projectId);

      // Construir mapa de adyacencia
      const adjacencyMap = new Map<string, string[]>();

      allLinks.forEach(link => {
        if (!adjacencyMap.has(link.sourceTaskId)) {
          adjacencyMap.set(link.sourceTaskId, []);
        }
        adjacencyMap.get(link.sourceTaskId)!.push(link.targetTaskId);
      });

      // Simular el nuevo enlace
      if (!adjacencyMap.has(sourceTaskId)) {
        adjacencyMap.set(sourceTaskId, []);
      }
      adjacencyMap.get(sourceTaskId)!.push(targetTaskId);

      // DFS para detectar ciclos
      const visited = new Set<string>();
      const recursionStack = new Set<string>();

      const dfs = (taskId: string): boolean => {
        visited.add(taskId);
        recursionStack.add(taskId);

        const neighbors = adjacencyMap.get(taskId) || [];
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            if (dfs(neighbor)) {
              return true;
            }
          } else if (recursionStack.has(neighbor)) {
            return true; // Ciclo detectado
          }
        }

        recursionStack.delete(taskId);
        return false;
      };

      // Verificar desde todos los nodos
      for (const [taskId] of adjacencyMap) {
        if (!visited.has(taskId)) {
          if (dfs(taskId)) {
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      console.error('Error detecting circular dependency:', error);
      // En caso de error, ser conservador y permitir el enlace
      return false;
    }
  }

  /**
   * Validar creación de enlace
   */
  static async validateLinkCreation(sourceTaskId: string, targetTaskId: string, projectId: string): Promise<{
    valid: boolean;
    error?: string;
  }> {
    try {
      // Validar que no sea un enlace circular (tarea a sí misma)
      if (sourceTaskId === targetTaskId) {
        return { valid: false, error: 'No se puede crear un enlace de una tarea a sí misma' };
      }

      // Verificar que el enlace no existe ya
      const existingLink = await this.findExistingLink(sourceTaskId, targetTaskId);
      if (existingLink) {
        return { valid: false, error: 'Ya existe un enlace entre estas tareas' };
      }

      // Verificar dependencias circulares
      const hasCircularDependency = await this.detectCircularDependency(sourceTaskId, targetTaskId, projectId);
      if (hasCircularDependency) {
        return { valid: false, error: 'Este enlace crearía una dependencia circular' };
      }

      return { valid: true };
    } catch (error) {
      console.error('Error validating link creation:', error);
      return { valid: false, error: 'Error al validar la creación del enlace' };
    }
  }
}

export default TaskLinkService;