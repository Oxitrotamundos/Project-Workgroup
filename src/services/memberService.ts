import {
  collection,
  query,
  getDocs,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  getDoc,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type {
  User,
  UserSearchResult,
  MemberSearchFilters,
  MemberManagementPermissions,
  ProjectMember,
  Project
} from '../types/firestore';

export class MemberService {
  /**
   * Buscar usuarios para agregar como miembros
   */
  static async searchUsers(filters: MemberSearchFilters): Promise<UserSearchResult[]> {
    try {
      const usersRef = collection(db, 'users');
      let q = query(usersRef, orderBy('displayName'));

      // Aplicar límite
      if (filters.limit) {
        q = query(q, limit(filters.limit));
      }

      const snapshot = await getDocs(q);
      let users = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserSearchResult[];

      // Filtrar por query de búsqueda
      if (filters.query) {
        const searchTerm = filters.query.toLowerCase();
        users = users.filter(user => 
          (user.displayName?.toLowerCase() || '').includes(searchTerm) ||
          (user.email?.toLowerCase() || '').includes(searchTerm)
        );
      }

      // Excluir miembros ya agregados
      if (filters.excludeMembers && filters.excludeMembers.length > 0) {
        users = users.filter(user => !filters.excludeMembers!.includes(user.id));
      }

      // Filtrar por rol
      if (filters.roleFilter && filters.roleFilter.length > 0) {
        users = users.filter(user => filters.roleFilter!.includes(user.role));
      }

      // Marcar si ya son miembros
      if (filters.excludeMembers) {
        users = users.map(user => ({
          ...user,
          isAlreadyMember: filters.excludeMembers!.includes(user.id)
        }));
      }

      return users.slice(0, filters.limit || 10);
    } catch (error) {
      console.error('Error searching users:', error);
      throw error;
    }
  }

  /**
   * Obtener información detallada de miembros de un proyecto
   */
  static async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    try {
      // Obtener el proyecto
      const projectDoc = await getDoc(doc(db, 'projects', projectId));
      if (!projectDoc.exists()) {
        throw new Error('Proyecto no encontrado');
      }

      const project = { id: projectDoc.id, ...projectDoc.data() } as Project;
      const memberIds = project.members || [];

      if (memberIds.length === 0) {
        return [];
      }

      // Obtener información de todos los miembros
      const memberPromises = memberIds.map(async (memberId) => {
        const userDoc = await getDoc(doc(db, 'users', memberId));
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          return {
            userId: memberId,
            email: userData.email,
            displayName: userData.displayName,
            role: userData.role,
            avatar: userData.avatar,
            joinedAt: userData.createdAt,
            addedBy: project.ownerId // Por simplicidad, asumimos que el owner agregó a todos
          } as ProjectMember;
        }
        return null;
      });

      const members = await Promise.all(memberPromises);
      return members.filter(member => member !== null) as ProjectMember[];
    } catch (error) {
      console.error('Error getting project members:', error);
      throw error;
    }
  }

  /**
   * Agregar miembro a un proyecto
   */
  static async addMember(projectId: string, userId: string, performedBy: string): Promise<void> {
    try {
      // Verificar permisos
      const canAdd = await this.canAddMember(projectId, performedBy, userId);
      if (!canAdd) {
        throw new Error('No tienes permisos para agregar este miembro');
      }

      // Agregar miembro al proyecto
      const projectRef = doc(db, 'projects', projectId);
      await updateDoc(projectRef, {
        members: arrayUnion(userId),
        updatedAt: new Date()
      });

      console.log(`Usuario ${userId} agregado al proyecto ${projectId} por ${performedBy}`);
    } catch (error) {
      console.error('Error adding member:', error);
      throw error;
    }
  }

  /**
   * Quitar miembro de un proyecto
   */
  static async removeMember(projectId: string, userId: string, performedBy: string): Promise<void> {
    try {
      // Verificar permisos
      const canRemove = await this.canRemoveMember(projectId, performedBy, userId);
      if (!canRemove) {
        throw new Error('No tienes permisos para quitar este miembro');
      }

      // Quitar miembro del proyecto
      const projectRef = doc(db, 'projects', projectId);
      await updateDoc(projectRef, {
        members: arrayRemove(userId),
        updatedAt: new Date()
      });

      console.log(`Usuario ${userId} removido del proyecto ${projectId} por ${performedBy}`);
    } catch (error) {
      console.error('Error removing member:', error);
      throw error;
    }
  }

  /**
   * Obtener permisos de gestión de miembros para un usuario
   */
  static async getMemberManagementPermissions(
    projectId: string, 
    userId: string
  ): Promise<MemberManagementPermissions> {
    try {
      // Obtener información del usuario
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) {
        throw new Error('Usuario no encontrado');
      }

      const user = userDoc.data() as User;
      const userRole = user.role;

      // Obtener información del proyecto
      const projectDoc = await getDoc(doc(db, 'projects', projectId));
      if (!projectDoc.exists()) {
        throw new Error('Proyecto no encontrado');
      }

      const project = projectDoc.data() as Project;
      const isOwner = project.ownerId === userId;

      // Definir permisos según rol
      const permissions: MemberManagementPermissions = {
        canAddMembers: userRole === 'admin' || (userRole === 'pm' && isOwner),
        canRemoveMembers: userRole === 'admin' || (userRole === 'pm' && isOwner),
        canChangeRoles: userRole === 'admin',
        canRemoveAdmin: userRole === 'admin',
        canRemovePM: userRole === 'admin'
      };

      return permissions;
    } catch (error) {
      console.error('Error getting member management permissions:', error);
      throw error;
    }
  }

  /**
   * Verificar si un usuario puede agregar un miembro específico
   */
  private static async canAddMember(
    projectId: string, 
    performerId: string, 
    targetUserId: string
  ): Promise<boolean> {
    try {
      const permissions = await this.getMemberManagementPermissions(projectId, performerId);
      
      if (!permissions.canAddMembers) {
        return false;
      }

      // Obtener rol del usuario a agregar
      const targetUserDoc = await getDoc(doc(db, 'users', targetUserId));
      if (!targetUserDoc.exists()) {
        return false;
      }

      const targetUser = targetUserDoc.data() as User;
      const performerDoc = await getDoc(doc(db, 'users', performerId));
      const performer = performerDoc.data() as User;

      // Admin puede agregar a cualquiera
      if (performer.role === 'admin') {
        return true;
      }

      // PM solo puede agregar members
      if (performer.role === 'pm' && targetUser.role === 'member') {
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking add member permission:', error);
      return false;
    }
  }

  /**
   * Verificar si un usuario puede quitar un miembro específico
   */
  private static async canRemoveMember(
    projectId: string, 
    performerId: string, 
    targetUserId: string
  ): Promise<boolean> {
    try {
      const permissions = await this.getMemberManagementPermissions(projectId, performerId);
      
      if (!permissions.canRemoveMembers) {
        return false;
      }

      // No se puede quitar a sí mismo si es el owner
      const projectDoc = await getDoc(doc(db, 'projects', projectId));
      const project = projectDoc.data() as Project;
      
      if (project.ownerId === targetUserId && performerId === targetUserId) {
        return false;
      }

      // Obtener roles
      const targetUserDoc = await getDoc(doc(db, 'users', targetUserId));
      const performerDoc = await getDoc(doc(db, 'users', performerId));
      
      if (!targetUserDoc.exists() || !performerDoc.exists()) {
        return false;
      }

      const targetUser = targetUserDoc.data() as User;
      const performer = performerDoc.data() as User;

      // Admin puede quitar a cualquiera
      if (performer.role === 'admin') {
        return true;
      }

      // PM puede quitar members pero no admin
      if (performer.role === 'pm' && targetUser.role === 'member') {
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking remove member permission:', error);
      return false;
    }
  }

  /**
   * Obtener usuarios agregados recientemente (para sugerencias)
   */
  static async getRecentlyAddedUsers(limitCount: number = 5): Promise<UserSearchResult[]> {
    try {
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserSearchResult[];
    } catch (error) {
      console.error('Error getting recently added users:', error);
      throw error;
    }
  }
}