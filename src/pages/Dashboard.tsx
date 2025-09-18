import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserService } from '../services/userService';
import { useNavigation } from '../components/Layout/AppLayout';
import ProjectList from '../components/ProjectList';
import ProjectModal from '../components/ProjectModal';
import type { Project, CreateProjectData, UpdateProjectData } from '../types/firestore';
import { useProjects } from '../hooks/useProjects';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { updateNavigation } = useNavigation();
  const { projects, loading, error, createProject, updateProject, deleteProject, hasMore, loadMore } = useProjects();
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');


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

  // Actualiza la navegación cuando se cargan los proyectos - solo cuando cambia la cantidad
  const prevProjectsLength = React.useRef<number>();
  React.useEffect(() => {
    if (prevProjectsLength.current !== projects.length) {
      updateNavigation({
        subtitle: `${projects.length} proyectos`
      });
      prevProjectsLength.current = projects.length;
    }
  }, [projects.length, updateNavigation]);

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
    // Navegar a la vista del proyecto/Gantt
    navigate(`/project/${projectId}`);
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
    <>
      {/* Main Content */}
      <main className="w-full py-6 px-4 sm:px-6 lg:px-8">
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
      </main>

      {/* Project Modal */}
      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleProjectSubmit}
        project={editingProject}
        mode={modalMode}
      />
    </>
  );
};

export default Dashboard;