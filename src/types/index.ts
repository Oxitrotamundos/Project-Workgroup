// Tipos de datos de usuarios
export interface User {
  id: string;
  uid: string; // Firebase UID
  email: string;
  displayName: string;
  role: 'admin' | 'pm' | 'member';
  avatar?: string;
  createdAt: Date;
}

// Tipos de datos de proyectos
export interface Project {
  id: string;
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  status: 'planning' | 'active' | 'completed' | 'on-hold';
  ownerId: string;
  members: string[]; // user IDs
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

// Tipos de datos de tareas
export interface Task {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  duration: number; // en días
  progress: number; // 0-100
  assigneeId?: string;
  dependencies: string[]; // IDs de tareas
  tags: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  color: string;
  estimatedHours: number;
  actualHours?: number;
  status: 'not-started' | 'in-progress' | 'completed' | 'blocked';
  createdAt: Date;
  updatedAt: Date;
}

// Tipos de datos de carga de trabajo
export interface WorkloadEntry {
  id: string;
  userId: string;
  taskId: string;
  projectId: string;
  date: Date;
  allocatedHours: number;
  actualHours?: number;
}

// Tipos de datos de contexto de autenticación
export interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

// Tipos de datos de formularios
export interface LoginFormData {
  email: string;
  password: string;
}

export interface SignUpFormData {
  email: string;
  password: string;
  confirmPassword: string;
  displayName: string;
}

export interface ProjectFormData {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  color: string;
}

export interface TaskFormData {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  assigneeId: string;
  priority: Task['priority'];
  color: string;
  estimatedHours: number;
  tags: string[];
}