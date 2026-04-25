import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { render } from '@testing-library/react'
import Login from '../../pages/Login'
import { useAuth } from '../../contexts/AuthContext'

vi.mock('../../contexts/AuthContext')

const mockUseAuth = vi.mocked(useAuth)

const buildAuth = (overrides: Partial<ReturnType<typeof useAuth>> = {}) => ({
  user: null,
  loading: false,
  signIn: vi.fn(),
  signInWithGoogle: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  logout: vi.fn(),
  resetPassword: vi.fn(),
  ...overrides,
})

const renderLogin = (initialEntries: { pathname: string; state?: unknown }[] = [{ pathname: '/login' }]) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <Login />
    </MemoryRouter>
  )

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Login', () => {
  it('renderiza inputs de email y password y botón "Iniciar sesión"', () => {
    mockUseAuth.mockReturnValue(buildAuth())
    renderLogin()

    expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeInTheDocument()
  })

  it('llama a signIn con email y password al enviar el formulario', async () => {
    const signIn = vi.fn().mockResolvedValue(undefined)
    mockUseAuth.mockReturnValue(buildAuth({ signIn }))
    renderLogin()

    await userEvent.type(screen.getByLabelText(/correo electrónico/i), 'user@example.com')
    await userEvent.type(screen.getByLabelText(/contraseña/i), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }))

    expect(signIn).toHaveBeenCalledWith('user@example.com', 'secret123')
  })

  it('muestra error si los campos están vacíos y NO llama a signIn', async () => {
    const signIn = vi.fn()
    mockUseAuth.mockReturnValue(buildAuth({ signIn }))
    renderLogin()

    await userEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }))

    expect(await screen.findByText(/por favor completa todos los campos/i)).toBeInTheDocument()
    expect(signIn).not.toHaveBeenCalled()
  })

  it('mapea auth/invalid-credential a "Correo o contraseña incorrectos"', async () => {
    const signIn = vi.fn().mockRejectedValue({ code: 'auth/invalid-credential' })
    mockUseAuth.mockReturnValue(buildAuth({ signIn }))
    renderLogin()

    await userEvent.type(screen.getByLabelText(/correo electrónico/i), 'user@example.com')
    await userEvent.type(screen.getByLabelText(/contraseña/i), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }))

    expect(await screen.findByText(/correo o contraseña incorrectos/i)).toBeInTheDocument()
  })

  it('mapea auth/too-many-requests a "Demasiados intentos"', async () => {
    const signIn = vi.fn().mockRejectedValue({ code: 'auth/too-many-requests' })
    mockUseAuth.mockReturnValue(buildAuth({ signIn }))
    renderLogin()

    await userEvent.type(screen.getByLabelText(/correo electrónico/i), 'user@example.com')
    await userEvent.type(screen.getByLabelText(/contraseña/i), 'whatever')
    await userEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }))

    expect(await screen.findByText(/demasiados intentos/i)).toBeInTheDocument()
  })

  it('mapea auth/operation-not-allowed a mensaje de admin', async () => {
    const signIn = vi.fn().mockRejectedValue({ code: 'auth/operation-not-allowed' })
    mockUseAuth.mockReturnValue(buildAuth({ signIn }))
    renderLogin()

    await userEvent.type(screen.getByLabelText(/correo electrónico/i), 'user@example.com')
    await userEvent.type(screen.getByLabelText(/contraseña/i), 'whatever')
    await userEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }))

    expect(
      await screen.findByText(/método de inicio de sesión no habilitado/i)
    ).toBeInTheDocument()
  })

  it('mantiene la sección "Otros métodos" colapsada por default', () => {
    mockUseAuth.mockReturnValue(buildAuth())
    renderLogin()

    expect(screen.getByRole('button', { name: /otros métodos de inicio de sesión/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /continuar con google/i })).not.toBeInTheDocument()
  })

  it('expande "Otros métodos" y muestra el botón de Google al hacer clic', async () => {
    mockUseAuth.mockReturnValue(buildAuth())
    renderLogin()

    await userEvent.click(screen.getByRole('button', { name: /otros métodos de inicio de sesión/i }))

    expect(screen.getByRole('button', { name: /continuar con google/i })).toBeInTheDocument()
  })

  it('invoca signInWithGoogle al hacer clic en "Continuar con Google"', async () => {
    const signInWithGoogle = vi.fn().mockResolvedValue(undefined)
    mockUseAuth.mockReturnValue(buildAuth({ signInWithGoogle }))
    renderLogin()

    await userEvent.click(screen.getByRole('button', { name: /otros métodos de inicio de sesión/i }))
    await userEvent.click(screen.getByRole('button', { name: /continuar con google/i }))

    expect(signInWithGoogle).toHaveBeenCalledTimes(1)
  })

  it('muestra el banner "registro deshabilitado" cuando location.state.signupDisabled es true', () => {
    mockUseAuth.mockReturnValue(buildAuth())
    renderLogin([{ pathname: '/login', state: { signupDisabled: true } }])

    expect(
      screen.getByText(/el registro de nuevas cuentas está deshabilitado/i)
    ).toBeInTheDocument()
  })

  it('NO muestra el banner cuando no se viene de /signup', () => {
    mockUseAuth.mockReturnValue(buildAuth())
    renderLogin()

    expect(
      screen.queryByText(/el registro de nuevas cuentas está deshabilitado/i)
    ).not.toBeInTheDocument()
  })
})
