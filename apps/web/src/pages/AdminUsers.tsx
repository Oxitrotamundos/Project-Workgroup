import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { UserService } from '../services/userService';
import { ApiError } from '../lib/apiClient';
import type { UserResponse, GlobalRole, UserStatus } from '@project-workgroup/shared';

const ROLE_OPTIONS: GlobalRole[] = ['admin', 'pm', 'member'];

export default function AdminUsers() {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const refresh = () =>
    UserService.adminListUsers()
      .then(setUsers)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar usuarios'))
      .finally(() => setLoading(false));

  useEffect(() => { refresh(); }, []);

  const handleRoleChange = async (id: string, role: GlobalRole) => {
    setError(null);
    setPendingId(id);
    try {
      await UserService.adminUpdateUser(id, { role });
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error al actualizar el rol');
    } finally {
      setPendingId(null);
    }
  };

  const handleToggleStatus = async (id: string, current: UserStatus) => {
    const next: UserStatus = current === 'active' ? 'disabled' : 'active';
    setError(null);
    setPendingId(id);
    try {
      await UserService.adminUpdateUser(id, { status: next });
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error al actualizar el estado');
    } finally {
      setPendingId(null);
    }
  };

  return (
    <section className="max-w-4xl mx-auto p-6 sm:p-8 space-y-6">
      <header>
        <p className="eyebrow" style={{ marginBottom: 'var(--s-2)' }}>Administración</p>
        <h1
          style={{
            font: '500 var(--t-h1)/var(--lh-h1) var(--font-sans)',
            letterSpacing: 'var(--tr-h1)',
            color: 'var(--ink)',
            margin: 0,
          }}
        >
          Usuarios
        </h1>
        <p
          style={{
            font: '400 var(--t-small)/var(--lh-small) var(--font-sans)',
            color: 'var(--ink-2)',
            margin: 'var(--s-2) 0 0',
          }}
        >
          Gestiona roles y estado de acceso de los usuarios.
        </p>
      </header>

      {error && (
        <div
          className="flex items-start gap-3"
          style={{
            background: 'var(--err-bg)',
            border: '1px solid var(--err-line)',
            borderRadius: 'var(--r-lg)',
            padding: 'var(--s-4)',
          }}
        >
          <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: 'var(--err-fg)' }} />
          <p style={{ font: '400 var(--t-small)/1.3 var(--font-sans)', color: 'var(--err-fg)', margin: 0 }}>
            {error}
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2" style={{ color: 'var(--ink-2)' }}>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span style={{ font: '400 var(--t-small)/var(--lh-small) var(--font-sans)' }}>Cargando…</span>
        </div>
      ) : (
        <div className="surface-table">
          <table className="tbl">
            <thead>
              <tr>
                <th>Usuario</th>
                <th style={{ width: 140 }}>Rol</th>
                <th style={{ width: 140 }}>Estado</th>
                <th style={{ width: 100 }}>{' '}</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--ink-3)', padding: 'var(--s-7)' }}>
                    No hay usuarios todavía.
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="avatar"
                        style={{ background: 'var(--p-500)', color: 'var(--ink-on-primary)' }}
                      >
                        {u.displayName.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p style={{ font: '500 var(--t-small)/1.2 var(--font-sans)', color: 'var(--ink-1)', margin: 0 }}>
                          {u.displayName}
                        </p>
                        <p
                          className="truncate"
                          style={{ font: '400 var(--t-caption)/1.2 var(--font-mono)', color: 'var(--ink-3)', margin: '2px 0 0' }}
                        >
                          {u.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <select
                      className="select"
                      value={u.role}
                      disabled={pendingId === u.id}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as GlobalRole)}
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span className={`badge ${u.status === 'active' ? 'ok' : 'warn'}`}>
                      {u.status === 'active' ? 'Activo' : 'Deshabilitado'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      onClick={() => handleToggleStatus(u.id, u.status)}
                      disabled={pendingId === u.id}
                      className={`btn btn-sm ${u.status === 'active' ? 'btn-danger' : 'btn-secondary'}`}
                    >
                      {u.status === 'active' ? 'Deshabilitar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
