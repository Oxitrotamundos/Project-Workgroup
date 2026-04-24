import '@testing-library/jest-dom/vitest'
import React, { createContext } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { vi } from 'vitest'
import type { AuthContextType, User } from '../types'

const mockUser: User = {
  id: 'test-uid',
  uid: 'test-uid',
  email: 'test@example.com',
  displayName: 'Test User',
  role: 'member',
  createdAt: new Date('2024-01-01')
}

interface MockAuthContextProps {
  user?: User | null
  loading?: boolean
}

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

export * from '@testing-library/react'
export { customRender as render, mockUser }
export type { MockAuthContextProps }