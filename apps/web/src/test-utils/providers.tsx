import React, { createContext } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import type { User as FirebaseUser } from 'firebase/auth'
import { vi } from 'vitest'
import type { AuthContextType, User } from '../types'

// Mock user para testing
const mockUser: User = {
  id: 'test-uid',
  uid: 'test-uid',
  email: 'test@example.com',
  displayName: 'Test User',
  role: 'member',
  createdAt: new Date('2024-01-01')
}

// Contexto de Auth para testing
interface MockAuthContextProps {
  user?: User | null
  loading?: boolean
}

// Crear contexto mock para tests
const MockAuthContext = createContext<AuthContextType | undefined>(undefined)

const createMockAuthContext = (props: MockAuthContextProps = {}): AuthContextType => ({
  user: props.user ?? mockUser,
  loading: props.loading ?? false,
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  logout: vi.fn(),
  resetPassword: vi.fn()
})

// Proveedor wrapper para tests
interface AllTheProvidersProps {
  children: React.ReactNode
  authProps?: MockAuthContextProps
}

const AllTheProviders: React.FC<AllTheProvidersProps> = ({ 
  children, 
  authProps = {} 
}) => {
  const mockAuthValue = createMockAuthContext(authProps)
  
  return (
    <BrowserRouter>
      <MockAuthContext.Provider value={mockAuthValue}>
        {children}
      </MockAuthContext.Provider>
    </BrowserRouter>
  )
}

// Función render personalizada
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  authProps?: MockAuthContextProps
}

const customRender = (
  ui: React.ReactElement,
  options: CustomRenderOptions = {}
) => {
  const { authProps, ...renderOptions } = options
  
  return render(ui, {
    wrapper: ({ children }) => (
      <AllTheProviders authProps={authProps}>
        {children}
      </AllTheProviders>
    ),
    ...renderOptions
  })
}

// Re-exportar todo lo necesario para tests
export * from '@testing-library/react'
export { customRender as render, mockUser }
export type { MockAuthContextProps }