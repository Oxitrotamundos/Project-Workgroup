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
  limit,
  startAfter,
  Timestamp,
  DocumentSnapshot
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type {
  Project,
  CreateProjectData,
  UpdateProjectData,
  ProjectFilters,
  PaginatedResponse
} from '../types/firestore';

const COLLECTION_NAME = 'projects';

/**
 * Servicio para gestionar proyectos en Firestore
 */
export class ProjectService {
  /**
   * Crear un nuevo proyecto
   */
  static async createProject(data: CreateProjectData): Promise<string> {
    try {
      const projectData = {
        ...data,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      const docRef = await addDoc(collection(db, COLLECTION_NAME), projectData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating project:', error);
      throw new Error('Error al crear el proyecto');
    }
  }

  /**
   * Obtener un proyecto por ID
   */
  static async getProject(id: string): Promise<Project | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate() || new Date(),
          updatedAt: docSnap.data().updatedAt?.toDate() || new Date(),
          startDate: docSnap.data().startDate?.toDate() || new Date(),
          endDate: docSnap.data().endDate?.toDate() || new Date()
        } as Project;
      }

      return null;
    } catch (error) {
      console.error('Error getting project:', error);
      throw new Error('Error al obtener el proyecto');
    }
  }

  /**
   * Obtener proyectos del usuario (como propietario o miembro)
   */
  static async getUserProjects(
    userId: string,
    filters?: ProjectFilters,
    pageSize: number = 10,
    lastDoc?: DocumentSnapshot
  ): Promise<PaginatedResponse<Project>> {
    try {
      let q = query(
        collection(db, COLLECTION_NAME),
        where('members', 'array-contains', userId),
        orderBy('updatedAt', 'desc')
      );

      // Aplicar filtros
      if (filters?.status) {
        q = query(q, where('status', '==', filters.status));
      }

      if (filters?.ownerId) {
        q = query(q, where('ownerId', '==', filters.ownerId));
      }

      // Paginación
      if (lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      q = query(q, limit(pageSize + 1)); // +1 para saber si hay más

      const querySnapshot = await getDocs(q);
      const projects: Project[] = [];
      const docs = querySnapshot.docs;

      // Procesar documentos
      const hasMore = docs.length > pageSize;
      const itemsToProcess = hasMore ? docs.slice(0, pageSize) : docs;

      itemsToProcess.forEach((doc) => {
        const data = doc.data();
        projects.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          startDate: data.startDate?.toDate() || new Date(),
          endDate: data.endDate?.toDate() || new Date()
        } as Project);
      });

      return {
        items: projects,
        total: projects.length, // En una implementación real, necesitarías una consulta separada para el total
        page: 1, // Simplificado para esta implementación
        pageSize,
        hasMore
      };
    } catch (error) {
      console.error('Error getting user projects:', error);
      throw new Error('Error al obtener los proyectos del usuario');
    }
  }

  /**
   * Actualizar un proyecto
   */
  static async updateProject(id: string, data: UpdateProjectData): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const updateData = {
        ...data,
        updatedAt: Timestamp.now()
      };

      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error updating project:', error);
      throw new Error('Error al actualizar el proyecto');
    }
  }

  /**
   * Eliminar un proyecto
   */
  static async deleteProject(id: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting project:', error);
      throw new Error('Error al eliminar el proyecto');
    }
  }

  /**
   * Agregar un miembro al proyecto
   */
  static async addMember(projectId: string, userId: string): Promise<void> {
    try {
      const project = await this.getProject(projectId);
      if (!project) {
        throw new Error('Proyecto no encontrado');
      }

      if (!project.members.includes(userId)) {
        const updatedMembers = [...project.members, userId];
        await this.updateProject(projectId, { members: updatedMembers });
      }
    } catch (error) {
      console.error('Error adding member:', error);
      throw new Error('Error al agregar miembro al proyecto');
    }
  }

  /**
   * Remover un miembro del proyecto
   */
  static async removeMember(projectId: string, userId: string): Promise<void> {
    try {
      const project = await this.getProject(projectId);
      if (!project) {
        throw new Error('Proyecto no encontrado');
      }

      const updatedMembers = project.members.filter(id => id !== userId);
      await this.updateProject(projectId, { members: updatedMembers });
    } catch (error) {
      console.error('Error removing member:', error);
      throw new Error('Error al remover miembro del proyecto');
    }
  }

  /**
   * Verificar si un usuario tiene acceso a un proyecto
   */
  static async hasAccess(projectId: string, userId: string): Promise<boolean> {
    try {
      const project = await this.getProject(projectId);
      if (!project) {
        return false;
      }

      return project.ownerId === userId || project.members.includes(userId);
    } catch (error) {
      console.error('Error checking access:', error);
      return false;
    }
  }

  /**
   * Obtener estadísticas básicas de un proyecto
   */
  static async getProjectStats() {
    try {
      // Esta función se implementará cuando tengamos las tareas
      // Por ahora retorna datos básicos
      return {
        totalTasks: 0,
        completedTasks: 0,
        inProgressTasks: 0,
        blockedTasks: 0,
        totalEstimatedHours: 0,
        totalActualHours: 0,
        progressPercentage: 0,
        membersCount: 0
      };
    } catch (error) {
      console.error('Error getting project stats:', error);
      throw new Error('Error al obtener estadísticas del proyecto');
    }
  }
}

export default ProjectService;