import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const mapAuthError = (err: unknown): string => {
  const code = (err as { code?: string } | null)?.code ?? '';
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Correo o contraseña incorrectos.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Intenta más tarde.';
    case 'auth/network-request-failed':
      return 'Error de red. Verifica tu conexión.';
    case 'auth/invalid-email':
      return 'Formato de correo inválido.';
    case 'auth/operation-not-allowed':
      return 'Método de inicio de sesión no habilitado. Contacta al administrador.';
    default:
      return 'Error al iniciar sesión. Inténtalo de nuevo.';
  }
};

const Login: React.FC = () => {
  const { signIn, signInWithGoogle } = useAuth();
  const location = useLocation();
  const signupDisabled = (location.state as { signupDisabled?: boolean } | null)?.signupDisabled === true;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [otherMethodsOpen, setOtherMethodsOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Por favor completa todos los campos.');
      return;
    }
    try {
      setError('');
      setLoading(true);
      await signIn(email, password);
    } catch (err) {
      console.error('Login error:', err);
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setError('');
      setLoading(true);
      await signInWithGoogle();
    } catch (err) {
      const code = (err as { code?: string } | null)?.code ?? '';
      if (code === 'auth/popup-closed-by-user') return;
      console.error('Google login error:', err);
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const alertStyle = (variant: 'warn' | 'err'): React.CSSProperties => ({
    background: `var(--${variant}-bg)`,
    border: `1px solid var(--${variant}-line)`,
    color: `var(--${variant}-fg)`,
    borderRadius: 'var(--r-md)',
    padding: 'var(--s-3) var(--s-4)',
    font: '400 var(--t-small)/var(--lh-small) var(--font-sans)',
  });

  return (
    <div
      className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8"
      style={{ background: 'var(--bg)' }}
    >
      <div
        className="max-w-md w-full"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-xl)',
          boxShadow: 'var(--sh-2)',
          padding: 'var(--s-8)',
        }}
      >
        <div className="text-center mb-6">
<p className="eyebrow" style={{ marginBottom: 'var(--s-2)' }}>
            Project Workgroup
          </p>
          <h2
            style={{
              font: '500 var(--t-h2)/var(--lh-h2) var(--font-sans)',
              letterSpacing: 'var(--tr-h2)',
              color: 'var(--ink)',
              margin: 0,
            }}
          >
            Iniciar sesión
          </h2>
          <p
            style={{
              font: '400 var(--t-small)/var(--lh-small) var(--font-sans)',
              color: 'var(--ink-2)',
              margin: 'var(--s-2) 0 0',
            }}
          >
            Bienvenido de vuelta
          </p>
        </div>

        {signupDisabled && (
          <div style={{ ...alertStyle('warn'), marginBottom: 'var(--s-4)' }}>
            El registro de nuevas cuentas está deshabilitado. Contacta al administrador.
          </div>
        )}

        {error && (
          <div style={{ ...alertStyle('err'), marginBottom: 'var(--s-4)' }}>
            {error}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="email" className="field-label">
              Correo electrónico
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="tu@email.com"
            />
          </div>
          <div className="field">
            <label htmlFor="password" className="field-label">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="Tu contraseña"
            />
          </div>
          <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full justify-center">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Iniciando sesión…' : 'Iniciar sesión'}
          </button>
        </form>

        <div style={{ borderTop: '1px solid var(--line)', marginTop: 'var(--s-6)', paddingTop: 'var(--s-4)' }}>
          <button
            type="button"
            onClick={() => setOtherMethodsOpen((v) => !v)}
            aria-expanded={otherMethodsOpen}
            className="btn btn-ghost btn-sm w-full justify-between"
          >
            <span>Otros métodos de inicio de sesión</span>
            {otherMethodsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {otherMethodsOpen && (
            <div className="mt-3">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="btn btn-secondary w-full justify-center"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continuar con Google
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
