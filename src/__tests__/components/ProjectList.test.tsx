import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render, type MockAuthContextProps } from '../../test-utils/providers'
import ProjectList from '../../components/ProjectList'
import { useProjects } from '../../hooks/useProjects'
import { useUserRole } from '../../hooks/useUserRole'
import { useAuth } from '../../contexts/AuthContext'
import type { Project } from '../../types/firestore'

// Mock hooks
vi.mock('../../hooks/useProjects')
vi.mock('../../hooks/useUserRole')
vi.mock('../../contexts/AuthContext')

const mockUseProjects = vi.mocked(useProjects)
const mockUseUserRole = vi.mocked(useUserRole)
const mockUseAuth = vi.mocked(useAuth)

// Mock data
const mockProjects: Project[] = [
  {
    id: 'project-1',
    name: 'Proyecto Test 1',
    description: 'Descripción del proyecto 1',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-12-31'),
    status: 'active',
    color: '#3B82F6',
    ownerId: 'user-1',
    members: ['user-1', 'user-2', 'test-uid'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    id: 'project-2',
    name: 'Proyecto Test 2',
    description: 'Descripción del proyecto 2',
    startDate: new Date('2024-02-01'),
    endDate: new Date('2024-11-30'),
    status: 'completed',
    color: '#10B981',
    ownerId: 'user-2',
    members: ['user-1', 'user-2', 'user-3', 'test-uid'],
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-01')
  }
]

const defaultUseProjectsReturn = {
  projects: mockProjects,
  loading: false,
  error: null,
  hasMore: false,
  loadMore: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  refresh: vi.fn(),
  loadMoreProjects: vi.fn(),
  addMember: vi.fn(),
  removeMember: vi.fn()
}

const defaultUseUserRoleReturn = {
  userRole: 'member' as const,
  loading: false,
  error: null,
  isAdmin: false,
  isPM: false,
  isMember: true
}

// Helper para renderizar ProjectList con props por defecto
const renderProjectList = (props: Partial<React.ComponentProps<typeof ProjectList>> = {}) => {
  const defaultProps = {
    projects: mockProjects,
    loading: false,
    error: null,
    hasMore: false,
    onCreateProject: vi.fn(),
    onEditProject: vi.fn(),
    onViewProject: vi.fn(),
    onDeleteProject: vi.fn(),
    onLoadMore: vi.fn(),
    ...props
  }
  return render(<ProjectList {...defaultProps} />)
}

describe('ProjectList Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseProjects.mockReturnValue(defaultUseProjectsReturn)
    mockUseUserRole.mockReturnValue(defaultUseUserRoleReturn)
    mockUseAuth.mockReturnValue({
      user: { uid: 'test-uid', email: 'test@example.com', displayName: 'Test User' } as any,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      logout: vi.fn(),
      resetPassword: vi.fn()
    })
  })

  describe('Renderizado básico', () => {
    it('debe renderizar la lista de proyectos correctamente', async () => {
      renderProjectList()
      
      expect(screen.getByText('Mis Proyectos')).toBeInTheDocument()
      expect(screen.getByText('2 proyectos encontrados')).toBeInTheDocument()
      expect(screen.getByText('Proyecto Test 1')).toBeInTheDocument()
      expect(screen.getByText('Proyecto Test 2')).toBeInTheDocument()
    })

    it('debe mostrar el indicador de administrador para usuarios admin', () => {
      mockUseUserRole.mockReturnValue({
        ...defaultUseUserRoleReturn,
        userRole: 'admin',
        isAdmin: true,
        isPM: false,
        isMember: false
      })
      
      renderProjectList()
      
      expect(screen.getByText('Vista de Administrador')).toBeInTheDocument()
    })

    it('debe mostrar botón "Nuevo Proyecto" para usuarios con permisos', () => {
      mockUseUserRole.mockReturnValue({
        ...defaultUseUserRoleReturn,
        userRole: 'pm',
        isAdmin: false,
        isPM: true,
        isMember: false
      })
      
      renderProjectList()
      
      expect(screen.getByText('Nuevo Proyecto')).toBeInTheDocument()
    })
  })

  describe('Estados de carga', () => {
    it('debe mostrar skeleton loader cuando está cargando', () => {
      renderProjectList({ loading: true, projects: [] })
      
      // Verificar que se muestran los skeletons
      const skeletons = screen.getAllByTestId('project-skeleton')
      expect(skeletons).toHaveLength(8) // Según la configuración del componente
    })

    it('debe mostrar estado vacío cuando no hay proyectos', () => {
      mockUseProjects.mockReturnValue({
        ...defaultUseProjectsReturn,
        projects: []
      })
      
      renderProjectList({ projects: [] })
      
      expect(screen.getByText('No hay proyectos')).toBeInTheDocument()
      expect(screen.getByText('No tienes acceso a ningún proyecto. Contacta con un administrador o PM para que te agregue a un proyecto.')).toBeInTheDocument()
    })
  })

  describe('Manejo de errores', () => {
    it('debe mostrar mensaje de error cuando falla la carga', () => {
      mockUseProjects.mockReturnValue({
        ...defaultUseProjectsReturn,
        error: 'Error al cargar proyectos',
        projects: []
      })
      
      renderProjectList({ error: 'Error al cargar proyectos' })
      
      expect(screen.getByRole('heading', { name: 'Error al cargar proyectos' })).toBeInTheDocument()
      expect(screen.getByText('Reintentar')).toBeInTheDocument()
    })

    it('debe llamar window.location.reload al hacer click en Reintentar', async () => {
      const mockReload = vi.fn()
      Object.defineProperty(window, 'location', {
        value: { reload: mockReload },
        writable: true
      })
      
      mockUseProjects.mockReturnValue({
        ...defaultUseProjectsReturn,
        error: 'Error al cargar proyectos',
        projects: []
      })
      
      const user = userEvent.setup()
      renderProjectList({ error: 'Error al cargar proyectos' })
      
      const retryButton = screen.getByText('Reintentar')
      await user.click(retryButton)
      
      expect(mockReload).toHaveBeenCalledOnce()
    })
  })

  describe('Interacciones de usuario', () => {
    it('debe llamar loadMore al hacer click en "Cargar Más Proyectos"', async () => {
      const mockLoadMore = vi.fn()
      mockUseProjects.mockReturnValue({
        ...defaultUseProjectsReturn,
        hasMore: true,
        loadMore: mockLoadMore
      })
      
      const user = userEvent.setup()
      renderProjectList({ hasMore: true, onLoadMore: mockLoadMore })
      
      const loadMoreButton = screen.getByText('Cargar Más Proyectos')
      await user.click(loadMoreButton)
      
      expect(mockLoadMore).toHaveBeenCalledOnce()
    })

    it('no debe mostrar botón "Cargar Más" cuando no hay más proyectos', () => {
      mockUseProjects.mockReturnValue({
        ...defaultUseProjectsReturn,
        hasMore: false
      })
      
      renderProjectList({ hasMore: false })
      
      expect(screen.queryByText('Cargar Más Proyectos')).not.toBeInTheDocument()
    })
  })

  describe('Permisos por rol', () => {
    it('debe mostrar botones de acción para administradores', () => {
      mockUseUserRole.mockReturnValue({
        ...defaultUseUserRoleReturn,
        userRole: 'admin',
        isAdmin: true,
        isPM: false,
        isMember: false
      })
      
      renderProjectList()
      
      // Los administradores pueden ver todos los botones
      const viewButtons = screen.getAllByLabelText('Ver proyecto')
      const editButtons = screen.getAllByLabelText('Editar proyecto')
      const deleteButtons = screen.getAllByLabelText('Eliminar proyecto')
      
      expect(viewButtons.length).toBeGreaterThan(0)
      expect(editButtons.length).toBeGreaterThan(0)
      expect(deleteButtons.length).toBeGreaterThan(0)
    })

    it('debe limitar botones de acción para miembros', () => {
      mockUseUserRole.mockReturnValue({
        ...defaultUseUserRoleReturn,
        userRole: 'member',
        isAdmin: false,
        isPM: false,
        isMember: true
      })
      
      renderProjectList()
      
      // Los miembros solo pueden ver proyectos
      const viewButtons = screen.getAllByLabelText('Ver proyecto')
      expect(viewButtons.length).toBeGreaterThan(0)
      
      // No deben ver botones de editar/eliminar en proyectos que no son suyos
      expect(screen.queryByLabelText('Eliminar proyecto')).not.toBeInTheDocument()
    })
  })

  describe('Responsividad', () => {
    it('debe aplicar clases de grid responsivo', () => {
      renderProjectList()
      
      const gridContainer = screen.getByTestId('projects-grid')
      expect(gridContainer).toHaveClass(
        'grid',
        'grid-cols-1',
        'sm:grid-cols-2',
        'lg:grid-cols-3',
        'xl:grid-cols-4'
      )
    })
  })

  describe('Integración con contexto de autenticación', () => {
    it('debe funcionar con usuario autenticado', () => {
      const authProps: MockAuthContextProps = {
        user: {
          id: 'test-uid',
          uid: 'test-uid',
          email: 'test@example.com',
          displayName: 'Test User',
          role: 'member',
          createdAt: new Date()
        } as any
      }
      
      // Configurar como admin para mostrar 'Todos los Proyectos'
      mockUseUserRole.mockReturnValue({
        ...defaultUseUserRoleReturn,
        userRole: 'admin',
        isAdmin: true,
        isPM: false,
        isMember: false
      })
      
      render(<ProjectList 
        projects={mockProjects}
        loading={false}
        error={null}
        hasMore={false}
        onCreateProject={vi.fn()}
        onEditProject={vi.fn()}
        onViewProject={vi.fn()}
        onDeleteProject={vi.fn()}
        onLoadMore={vi.fn()}
      />, { authProps })
      
      expect(screen.getByText('Todos los Proyectos')).toBeInTheDocument()
    })

    it('debe manejar usuario no autenticado', () => {
      const authProps: MockAuthContextProps = {
        user: null
      }
      
      // Configurar como admin para mostrar 'Todos los Proyectos'
      mockUseUserRole.mockReturnValue({
        ...defaultUseUserRoleReturn,
        userRole: 'admin',
        isAdmin: true,
        isPM: false,
        isMember: false
      })
      
      render(<ProjectList 
        projects={mockProjects}
        loading={false}
        error={null}
        hasMore={false}
        onCreateProject={vi.fn()}
        onEditProject={vi.fn()}
        onViewProject={vi.fn()}
        onDeleteProject={vi.fn()}
        onLoadMore={vi.fn()}
      />, { authProps })
      
      // El componente debería manejar gracefully el caso de usuario no autenticado
      expect(screen.getByText('Todos los Proyectos')).toBeInTheDocument()
    })
  })
})