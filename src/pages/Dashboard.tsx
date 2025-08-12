import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserService } from '../services/userService';
import ProjectList from '../components/ProjectList';
import ProjectModal from '../components/ProjectModal';
import type { Project, CreateProjectData, UpdateProjectData } from '../types/firestore';
import { useProjects } from '../hooks/useProjects';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const { projects, loading, error, createProject, updateProject, deleteProject, hasMore, loadMore } = useProjects();
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  // Crear usuario en Firestore si no existe
  React.useEffect(() => {
    const createUserIfNotExists = async () => {
      if (user) {
        try {
          const userExists = await UserService.userExists(user.uid);
          if (!userExists) {
            await UserService.createOrUpdateUser(user.uid, {
              email: user.email || '',
              displayName: user.displayName || user.email?.split('@')[0] || 'Usuario',
              role: 'member'
            });
          }
        } catch (error) {
          console.error('Error creating user in Firestore:', error);
        }
      }
    };

    createUserIfNotExists();
  }, [user]);

  const handleCreateProject = () => {
    setEditingProject(null);
    setModalMode('create');
    setIsProjectModalOpen(true);
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setModalMode('edit');
    setIsProjectModalOpen(true);
  };

  const handleViewProject = (projectId: string) => {
    // TODO: Navegar a la vista del proyecto/Gantt
    console.log('Viewing project:', projectId);
    alert(`Navegando al proyecto ${projectId}. Esta funcionalidad se implementará en la siguiente fase.`);
  };

  const handleProjectSubmit = async (data: CreateProjectData | UpdateProjectData) => {
    try {
      if (modalMode === 'create') {
        await createProject(data as CreateProjectData);
      } else if (editingProject) {
        await updateProject(editingProject.id, data as UpdateProjectData);
      }
      setIsProjectModalOpen(false);
      setEditingProject(null);
    } catch (error) {
      console.error('Error submitting project:', error);
      throw error; // Re-throw para que el modal pueda manejar el error
    }
  };

  const handleCloseModal = () => {
    setIsProjectModalOpen(false);
    setEditingProject(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-xl font-bold text-gray-900">Gantt Workgroup</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
                  </span>
                </div>
                <span className="text-gray-700 text-sm">
                  {user?.displayName || user?.email}
                </span>
              </div>
              
              <button
                onClick={handleLogout}
                className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <ProjectList
            projects={projects}
            loading={loading}
            error={error}
            hasMore={hasMore}
            onCreateProject={handleCreateProject}
            onEditProject={handleEditProject}
            onViewProject={handleViewProject}
            onDeleteProject={deleteProject}
            onLoadMore={loadMore}
          />
        </div>
      </main>

      {/* Project Modal */}
      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleProjectSubmit}
        project={editingProject}
        mode={modalMode}
      />
    </div>
  );
};

export default Dashboard;