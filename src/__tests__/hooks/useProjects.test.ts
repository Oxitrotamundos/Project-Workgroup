import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useProjects } from '../../hooks/useProjects'
import { ProjectService } from '../../services/projectService'
import { useUserRole } from '../../hooks/useUserRole'
import { useAuth } from '../../contexts/AuthContext'

// Mock de dependencias
vi.mock('../../services/projectService')
vi.mock('../../hooks/useUserRole')
vi.mock('../../contexts/AuthContext')

const mockUseUserRole = vi.mocked(useUserRole)
const mockUseAuth = vi.mocked(useAuth)

// Mock data
const mockUser = {
  id: 'test-uid',
  uid: 'test-uid',
  email: 'test@example.com',
  displayName: 'Test User',
  role: 'member' as const,
  createdAt: new Date('2024-01-01')
}

const mockProjects = [
  {
    id: 'project-1',
    name: 'Test Project 1',
    description: 'A test project',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-12-31'),
    status: 'active' as const,
    ownerId: 'test-uid',
    members: ['test-uid'],
    color: '#3B82F6',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    id: 'project-2',
    name: 'Test Project 2',
    description: 'Another test project',
    startDate: new Date('2024-02-01'),
    endDate: new Date('2024-11-30'),
    status: 'planning' as const,
    ownerId: 'test-uid',
    members: ['test-uid'],
    color: '#10B981',
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-01')
  }
]

describe('useProjects Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default mocks
    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      logout: vi.fn(),
      resetPassword: vi.fn()
    })
    
    mockUseUserRole.mockReturnValue({
      userRole: 'member',
      loading: false,
      error: null,
      isAdmin: false,
      isPM: false,
      isMember: true
    })
    
    // Mock ProjectService methods
    ProjectService.getUserProjects = vi.fn().mockResolvedValue({
      items: mockProjects,
      hasMore: false,
      total: mockProjects.length,
      page: 1,
      pageSize: 10
    })
    
    ProjectService.getAllProjects = vi.fn().mockResolvedValue({
      items: mockProjects,
      hasMore: false,
      total: mockProjects.length,
      page: 1,
      pageSize: 10
    })
  })

  describe('Carga inicial', () => {
    it('debe cargar proyectos del usuario por defecto', async () => {
      const { result } = renderHook(() => useProjects())
      
      expect(result.current.loading).toBe(true)
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      expect(result.current.projects).toEqual(mockProjects)
      expect(result.current.error).toBeNull()
      expect(ProjectService.getUserProjects).toHaveBeenCalledWith('test-uid', undefined, 10)
    })

    it('debe cargar todos los proyectos para administradores', async () => {
      mockUseUserRole.mockReturnValue({
        userRole: 'admin',
        loading: false,
        error: null,
        isAdmin: true,
        isPM: false,
        isMember: false
      })
      
      const { result } = renderHook(() => useProjects())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      expect(ProjectService.getAllProjects).toHaveBeenCalled()
      expect(result.current.projects).toEqual(mockProjects)
    })

    it('debe manejar el estado de carga del rol de usuario', async () => {
      mockUseUserRole.mockReturnValue({
        userRole: null,
        loading: true,
        error: null,
        isAdmin: false,
        isPM: false,
        isMember: false
      })
      
      const { result } = renderHook(() => useProjects())
      
      expect(result.current.loading).toBe(true)
      
      // No debe hacer llamadas mientras el rol está cargando
      expect(ProjectService.getUserProjects).not.toHaveBeenCalled()
      expect(ProjectService.getAllProjects).not.toHaveBeenCalled()
    })
  })

  describe('Manejo de errores', () => {
    it('debe manejar errores de carga de proyectos', async () => {
      const errorMessage = 'Error al cargar proyectos'
      ProjectService.getUserProjects = vi.fn().mockRejectedValue(new Error(errorMessage))
      
      // Asegurar que user y userRole estén disponibles para que se ejecute la carga
      mockUseAuth.mockReturnValue({
        user: {
          id: 'test-uid',
          uid: 'test-uid',
          email: 'test@example.com',
          displayName: 'Test User',
          role: 'member',
          createdAt: new Date('2024-01-01')
        },
        loading: false,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
        logout: vi.fn(),
        resetPassword: vi.fn()
      })
      
      mockUseUserRole.mockReturnValue({
        userRole: 'member',
        loading: false,
        error: null,
        isAdmin: false,
        isPM: false,
        isMember: false
      })
      
      const { result } = renderHook(() => useProjects())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      expect(result.current.error).toBe(errorMessage)
      expect(result.current.projects).toEqual([])
    })

    it('debe manejar errores de permisos', async () => {
      ProjectService.getUserProjects = vi.fn().mockRejectedValue(new Error('Permission denied'))
      
      // Asegurar que user y userRole estén disponibles para que se ejecute la carga
      mockUseAuth.mockReturnValue({
        user: {
          id: 'test-uid',
          uid: 'test-uid',
          email: 'test@example.com',
          displayName: 'Test User',
          role: 'admin',
          createdAt: new Date('2024-01-01')
        },
        loading: false,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
        logout: vi.fn(),
        resetPassword: vi.fn()
      })
      
      mockUseUserRole.mockReturnValue({
        userRole: 'member',
        loading: false,
        error: null,
        isAdmin: false,
        isPM: false,
        isMember: false
      })
      
      const { result } = renderHook(() => useProjects())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      expect(result.current.error).toBe('Permission denied')
    })
  })

  describe('Casos edge', () => {
    it('debe manejar usuario no autenticado', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
        logout: vi.fn(),
        resetPassword: vi.fn()
      })
      
      const { result } = renderHook(() => useProjects())
      
      expect(result.current.loading).toBe(false)
      expect(result.current.projects).toEqual([])
      expect(result.current.error).toBeNull()
      
      // No debe hacer llamadas sin usuario
      expect(ProjectService.getUserProjects).not.toHaveBeenCalled()
      expect(ProjectService.getAllProjects).not.toHaveBeenCalled()
    })

    it('debe limpiar estado al desmontar', () => {
      const { unmount } = renderHook(() => useProjects())
      
      // El hook debería limpiar cualquier estado pendiente
      expect(() => unmount()).not.toThrow()
    })
  })

  describe('Optimizaciones de rendimiento', () => {
    it('no debe hacer llamadas duplicadas durante la carga inicial', async () => {
      const { result } = renderHook(() => useProjects())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      // Solo debe haber una llamada inicial
      expect(ProjectService.getUserProjects).toHaveBeenCalledTimes(1)
    })
  })
})