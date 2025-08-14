import { useCallback } from 'react';
import type { Task } from '../types/firestore';

interface UseGanttActionsProps {
  projectId: string;
  onTasksChange?: () => void;
}

interface UseGanttActionsReturn {
  handleTaskUpdate: (taskId: string, updates: Partial<Task>) => Promise<void>;
  handleTaskAdd: (task: Partial<Task>) => Promise<void>;
  handleTaskDelete: (taskId: string) => Promise<void>;
  handleTaskSelect: (taskId: string) => void;
}

export const useGanttActions = ({
  projectId,
  onTasksChange
}: UseGanttActionsProps): UseGanttActionsReturn => {

  const handleTaskUpdate = useCallback(async (taskId: string, updates: Partial<Task>) => {
    try {
      console.log('Updating task:', taskId, updates);
      
      // Aquí se implementaría la actualización en Firestore
      // await TaskService.updateTask(taskId, updates);
      
      // Por ahora solo logueamos la acción AB.
      console.log('Task updated successfully');
      
      // Notificar cambios
      if (onTasksChange) {
        onTasksChange();
      }
    } catch (error) {
      console.error('Error updating task:', error);
      throw new Error('Error al actualizar la tarea');
    }
  }, [onTasksChange]);

  const handleTaskAdd = useCallback(async (task: Partial<Task>) => {
    try {
      console.log('Adding new task:', task);
      
      // TODO: Implementar creación de tarea en Firestore
      // const taskData: Omit<Task, 'id'> = {
      //   name: task.name || 'Nueva Tarea',
      //   description: task.description || '',
      //   startDate: task.startDate || new Date(),
      //   endDate: task.endDate || new Date(),
      //   duration: task.duration || 1,
      //   progress: task.progress || 0,
      //   status: task.status || 'not-started',
      //   priority: task.priority || 'medium',
      //   assigneeId: task.assigneeId,
      //   projectId: projectId,
      //   createdAt: new Date(),
      //   updatedAt: new Date(),
      //   dependencies: task.dependencies || [],
      //   tags: task.tags || [],
      //   color: task.color || '#3B82F6',
      //   estimatedHours: task.estimatedHours || 8
      // };
      // await TaskService.createTask(taskData);
      
      console.log('Task added successfully');
      
      // Notificar cambios
      if (onTasksChange) {
        onTasksChange();
      }
    } catch (error) {
      console.error('Error adding task:', error);
      throw new Error('Error al crear la tarea');
    }
  }, [projectId, onTasksChange]);

  const handleTaskDelete = useCallback(async (taskId: string) => {
    try {
      console.log('Deleting task:', taskId);
      
      // Aquí se implementaría la eliminación en Firestore
      // await TaskService.deleteTask(taskId);
      
      console.log('Task deleted successfully');
      
      // Notificar cambios
      if (onTasksChange) {
        onTasksChange();
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      throw new Error('Error al eliminar la tarea');
    }
  }, [onTasksChange]);

  const handleTaskSelect = useCallback((taskId: string) => {
    console.log('Task selected:', taskId);
    // Aquí se podría implementar lógica adicional para la selección
    // como mostrar detalles de la tarea, abrir un modal, etc.
  }, []);

  return {
    handleTaskUpdate,
    handleTaskAdd,
    handleTaskDelete,
    handleTaskSelect
  };
};

export default useGanttActions;