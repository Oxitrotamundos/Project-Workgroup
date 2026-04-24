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
      
      // Usar TaskManager para crear la tarea
      const { taskManager } = await import('../services/taskManager');
      await taskManager.createTask({
        projectId,
        name: task.name || 'Nueva Tarea',
        description: task.description || '',
        assigneeId: task.assigneeId || '',
        priority: task.priority || 'medium',
        estimatedHours: task.estimatedHours || 8,
        startDate: task.startDate instanceof Date ? task.startDate : task.startDate?.toDate(),
        endDate: task.endDate instanceof Date ? task.endDate : task.endDate?.toDate(),
        duration: task.duration
      });
      
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