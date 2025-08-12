/**
 * Tipos TypeScript para las colecciones de Firestore
 */

import { Timestamp } from 'firebase/firestore';

// Tipos base
export type UserRole = 'admin' | 'pm' | 'member';
export type ProjectStatus = 'planning' | 'active' | 'completed' | 'on-hold';
export type TaskStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

// Interfaz base para documentos con timestamps
export interface BaseDocument {
  id: string;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

// Colección: users
export interface User extends BaseDocument {
  email: string;
  displayName: string;
  role: UserRole;
  avatar?: string;
}

// Datos para crear usuario (sin campos auto-generados)
export interface CreateUserData {
  email: string;
  displayName: string;
  role: UserRole;
  avatar?: string;
}

// Datos para actualizar usuario
export interface UpdateUserData {
  displayName?: string;
  role?: UserRole;
  avatar?: string;
}

// Colección: projects
export interface Project extends BaseDocument {
  name: string;
  description: string;
  startDate: Date | Timestamp;
  endDate: Date | Timestamp;
  status: ProjectStatus;
  ownerId: string;
  members: string[]; // user IDs
  color: string;
}

// Datos para crear proyecto
export interface CreateProjectData {
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  status: ProjectStatus;
  ownerId: string;
  members: string[];
  color: string;
}

// Datos para actualizar proyecto
export interface UpdateProjectData {
  name?: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  status?: ProjectStatus;
  members?: string[];
  color?: string;
}

// Colección: tasks
export interface Task extends BaseDocument {
  projectId: string;
  name: string;
  description?: string;
  startDate: Date | Timestamp;
  endDate: Date | Timestamp;
  duration: number; // en días
  progress: number; // 0-100
  assigneeId?: string;
  dependencies: string[]; // task IDs
  tags: string[];
  priority: TaskPriority;
  color: string;
  estimatedHours: number;
  actualHours?: number;
  status: TaskStatus;
}

// Datos para crear tarea
export interface CreateTaskData {
  projectId: string;
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  duration: number;
  progress: number;
  assigneeId?: string;
  dependencies: string[];
  tags: string[];
  priority: TaskPriority;
  color: string;
  estimatedHours: number;
  actualHours?: number;
  status: TaskStatus;
}

// Datos para actualizar tarea
export interface UpdateTaskData {
  name?: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  duration?: number;
  progress?: number;
  assigneeId?: string;
  dependencies?: string[];
  tags?: string[];
  priority?: TaskPriority;
  color?: string;
  estimatedHours?: number;
  actualHours?: number;
  status?: TaskStatus;
}

// Colección: workload
export interface WorkloadEntry {
  id: string;
  userId: string;
  taskId: string;
  projectId: string;
  date: Date | Timestamp;
  allocatedHours: number;
  actualHours?: number;
}

// Datos para crear entrada de carga de trabajo
export interface CreateWorkloadData {
  userId: string;
  taskId: string;
  projectId: string;
  date: Date;
  allocatedHours: number;
  actualHours?: number;
}

// Datos para actualizar entrada de carga de trabajo
export interface UpdateWorkloadData {
  allocatedHours?: number;
  actualHours?: number;
}

// Tipos para consultas y filtros
export interface ProjectFilters {
  status?: ProjectStatus;
  ownerId?: string;
  memberId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface TaskFilters {
  projectId?: string;
  assigneeId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  tags?: string[];
  startDate?: Date;
  endDate?: Date;
}

export interface WorkloadFilters {
  userId?: string;
  projectId?: string;
  taskId?: string;
  startDate?: Date;
  endDate?: Date;
}

// Tipos para estadísticas y reportes
export interface ProjectStats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  blockedTasks: number;
  totalEstimatedHours: number;
  totalActualHours: number;
  progressPercentage: number;
  membersCount: number;
}

export interface UserWorkloadStats {
  userId: string;
  userName: string;
  totalAllocatedHours: number;
  totalActualHours: number;
  activeTasks: number;
  completedTasks: number;
  overloadedDays: number;
}

export interface TaskDependency {
  taskId: string;
  dependsOn: string;
  type: 'finish-to-start' | 'start-to-start' | 'finish-to-finish' | 'start-to-finish';
}

// Tipos para eventos y actividad
export interface ActivityLog {
  id: string;
  projectId: string;
  userId: string;
  action: 'created' | 'updated' | 'deleted' | 'assigned' | 'completed';
  entityType: 'project' | 'task' | 'user';
  entityId: string;
  description: string;
  timestamp: Date | Timestamp;
  metadata?: Record<string, any>;
}

// Tipos para comentarios (si se implementan)
export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  content: string;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
  mentions?: string[]; // user IDs mencionados
}

// Tipos para notificaciones
export interface Notification {
  id: string;
  userId: string;
  type: 'task_assigned' | 'task_completed' | 'project_updated' | 'deadline_approaching';
  title: string;
  message: string;
  read: boolean;
  createdAt: Date | Timestamp;
  relatedEntityId?: string;
  relatedEntityType?: 'project' | 'task';
}

// Tipos para configuración de usuario
export interface UserPreferences {
  userId: string;
  theme: 'light' | 'dark' | 'system';
  language: 'es' | 'en';
  timezone: string;
  notifications: {
    email: boolean;
    push: boolean;
    taskAssignments: boolean;
    deadlineReminders: boolean;
    projectUpdates: boolean;
  };
  ganttView: {
    defaultZoom: 'day' | 'week' | 'month';
    showWeekends: boolean;
    showDependencies: boolean;
  };
}

// Tipos para exportación
export interface ExportOptions {
  format: 'pdf' | 'excel' | 'csv';
  includeCompleted: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  projectIds?: string[];
  taskIds?: string[];
}

// Tipos para respuestas de API
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  lastDoc?: any; // DocumentSnapshot para paginación
}

// Tipos para validación
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// Tipos para permisos
export interface ProjectPermissions {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canManageMembers: boolean;
  canManageTasks: boolean;
}

export interface UserPermissions {
  isAdmin: boolean;
  isPM: boolean;
  isMember: boolean;
  projects: Record<string, ProjectPermissions>;
}

// Constantes útiles
export const DEFAULT_TASK_COLOR = '#3B82F6';
export const DEFAULT_PROJECT_COLOR = '#10B981';
export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: '#10B981',
  medium: '#F59E0B',
  high: '#EF4444',
  critical: '#DC2626'
};
export const STATUS_COLORS: Record<TaskStatus, string> = {
  'not-started': '#6B7280',
  'in-progress': '#3B82F6',
  'completed': '#10B981',
  'blocked': '#EF4444'
};

// Funciones de utilidad para tipos
export function isValidUserRole(role: string): role is UserRole {
  return ['admin', 'pm', 'member'].includes(role);
}

export function isValidProjectStatus(status: string): status is ProjectStatus {
  return ['planning', 'active', 'completed', 'on-hold'].includes(status);
}

export function isValidTaskStatus(status: string): status is TaskStatus {
  return ['not-started', 'in-progress', 'completed', 'blocked'].includes(status);
}

export function isValidTaskPriority(priority: string): priority is TaskPriority {
  return ['low', 'medium', 'high', 'critical'].includes(priority);
}