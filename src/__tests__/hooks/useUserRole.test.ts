import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useUserRole } from '../../hooks/useUserRole'
import { UserService } from '../../services/userService'
import { useAuth } from '../../contexts/AuthContext'

// Mock de dependencias
vi.mock('../../services/userService')
vi.mock('../../contexts/AuthContext')

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

const mockAdminUser = {
  id: 'admin-uid',
  uid: 'admin-uid',
  email: 'admin@example.com',
  displayName: 'Admin User',
  role: 'admin' as const,
  createdAt: new Date('2024-01-01')
}

describe('useUserRole Hook', () => {
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
  })

  describe('Carga inicial', () => {
    it('debe cargar el rol de usuario correctamente', async () => {
      UserService.getUser = vi.fn().mockResolvedValue({ role: 'member' })
      
      const { result } = renderHook(() => useUserRole())
      
      expect(result.current.loading).toBe(true)
      expect(result.current.userRole).toBeNull()
      expect(result.current.error).toBeNull()
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      expect(result.current.userRole).toBe('member')
      expect(result.current.error).toBeNull()
      expect(UserService.getUser).toHaveBeenCalledWith('test-uid')
    })

    it('debe cargar rol de administrador', async () => {
      mockUseAuth.mockReturnValue({
        user: mockAdminUser,
        loading: false,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
        logout: vi.fn(),
        resetPassword: vi.fn()
      })
      
      UserService.getUser = vi.fn().mockResolvedValue({ role: 'admin' })
      
      const { result } = renderHook(() => useUserRole())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      expect(result.current.userRole).toBe('admin')
      expect(UserService.getUser).toHaveBeenCalledWith('admin-uid')
    })

    it('debe manejar usuario sin rol definido', async () => {
      UserService.getUser = vi.fn().mockResolvedValue(null)
      
      const { result } = renderHook(() => useUserRole())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      expect(result.current.userRole).toBe('member') // Rol por defecto
      expect(result.current.error).toBeNull()
    })
  })

  describe('Estados de autenticación', () => {
    it('debe manejar usuario no autenticado', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
        logout: vi.fn(),
        resetPassword: vi.fn()
      })
      
      const { result } = renderHook(() => useUserRole())
      
      expect(result.current.loading).toBe(false)
      expect(result.current.userRole).toBeNull()
      expect(result.current.error).toBeNull()
      
      // No debe hacer llamadas sin usuario
      expect(UserService.getUser).not.toHaveBeenCalled()
    })

    it('debe manejar estado de carga de autenticación', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: true,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
        logout: vi.fn(),
        resetPassword: vi.fn()
      })
      
      const { result } = renderHook(() => useUserRole())
      
      expect(result.current.loading).toBe(false)
      expect(result.current.userRole).toBeNull()
      expect(result.current.error).toBeNull()
      
      // No debe hacer llamadas mientras auth está cargando
      expect(UserService.getUser).not.toHaveBeenCalled()
    })
  })

  describe('Manejo de errores', () => {
    it('debe manejar errores de servicio', async () => {
      const errorMessage = 'Error al obtener rol de usuario'
      UserService.getUser = vi.fn().mockRejectedValue(new Error(errorMessage))
      
      const { result } = renderHook(() => useUserRole())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      expect(result.current.userRole).toBe('member') // Rol por defecto en caso de error
      expect(result.current.error).toBe('Error al obtener el rol del usuario')
    })

    it('debe manejar errores de permisos', async () => {
      UserService.getUser = vi.fn().mockRejectedValue(
        new Error('Permission denied')
      )
      
      const { result } = renderHook(() => useUserRole())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      expect(result.current.error).toBe('Error al obtener el rol del usuario')
      expect(result.current.userRole).toBe('member') // Rol por defecto
    })
  })

  describe('Casos edge', () => {
    it('debe manejar respuesta undefined del servicio', async () => {
      UserService.getUser = vi.fn().mockResolvedValue(undefined)
      
      const { result } = renderHook(() => useUserRole())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      expect(result.current.userRole).toBe('member') // Rol por defecto
      expect(result.current.error).toBeNull()
    })

    it('debe limpiar estado al desmontar', () => {
      const { unmount } = renderHook(() => useUserRole())
      
      expect(() => unmount()).not.toThrow()
    })
  })

  describe('Propiedades derivadas', () => {
    it('debe calcular isAdmin correctamente', async () => {
      UserService.getUser = vi.fn().mockResolvedValue({ role: 'admin' })
      
      const { result } = renderHook(() => useUserRole())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      expect(result.current.isAdmin).toBe(true)
      expect(result.current.isPM).toBe(false)
      expect(result.current.isMember).toBe(false)
    })

    it('debe calcular isPM correctamente', async () => {
      UserService.getUser = vi.fn().mockResolvedValue({ role: 'pm' })
      
      const { result } = renderHook(() => useUserRole())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      expect(result.current.isAdmin).toBe(false)
      expect(result.current.isPM).toBe(true)
      expect(result.current.isMember).toBe(false)
    })

    it('debe calcular isMember correctamente', async () => {
      UserService.getUser = vi.fn().mockResolvedValue({ role: 'member' })
      
      const { result } = renderHook(() => useUserRole())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      expect(result.current.isAdmin).toBe(false)
      expect(result.current.isPM).toBe(false)
      expect(result.current.isMember).toBe(true)
    })
  })
})