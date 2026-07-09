import { useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle, Loader2, UserPlus, X } from 'lucide-react';
import { UserService } from '../services/userService';
import { ApiError } from '../lib/apiClient';
import type { UserResponse, GlobalRole, UserStatus } from '@project-workgroup/shared';

const ROLE_OPTIONS: GlobalRole[] = ['admin', 'pm', 'member'];

interface CreateUserModalProps {
  onClose: () => void;
  onCreated: () => Promise<void>;
}

function CreateUserModal({ onClose, onCreated }: CreateUserModalProps) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<GlobalRole>('member');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordTooShort = password.length > 0 && password.length < 6;
  const isValid = email.trim() !== '' && displayName.trim() !== '' && password.length >= 6;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setSaving(true);
    setError(null);
    try {
      await UserService.adminCreateUser({
        email: email.trim(),
        displayName: displayName.trim(),
        password,
        role,
      });
      await onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error al crear el usuario');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="ttl">Crear Usuario</h2>
          <button onClick={onClose} className="btn btn-ghost btn-icon btn-sm" disabled={saving} aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="contents">
          <div className="modal-body space-y-4">
            <div className="field">
              <label htmlFor="cu-email" className="field-label">Email *</label>
              <input
                type="email"
                id="cu-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="usuario@empresa.com"
                disabled={saving}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="cu-displayName" className="field-label">Nombre para mostrar *</label>
              <input
                type="text"
                id="cu-displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="input"
                placeholder="Nombre Apellido"
                disabled={saving}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="cu-password" className="field-label">Contraseña *</label>
              <input
                type="password"
                id="cu-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="Mínimo 6 caracteres"
                disabled={saving}
                required
              />
              {passwordTooShort && (
                <p style={{ color: 'var(--err-fg)', font: '400 var(--t-caption)/1.3 var(--font-sans)', margin: '4px 0 0' }}>
                  La contraseña debe tener al menos 6 caracteres
                </p>
              )}
            </div>

            <div className="field">
              <label htmlFor="cu-role" className="field-label">Rol</label>
              <select
                id="cu-role"
                value={role}
                onChange={(e) => setRole(e.target.value as GlobalRole)}
                className="select"
                disabled={saving}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {error && (
              <div
                style={{
                  background: 'var(--err-bg)',
                  border: '1px solid var(--err-line)',
                  color: 'var(--err-fg)',
                  borderRadius: 'var(--r-md)',
                  padding: 'var(--s-3) var(--s-4)',
                  font: '400 var(--t-small)/var(--lh-small) var(--font-sans)',
                }}
              >
                {error}
              </div>
            )}
          </div>

          <div className="modal-foot">
            <button type="button" onClick={onClose} className="btn btn-secondary" disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !isValid}>
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Crear
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

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
      <header className="flex items-start justify-between gap-4">
        <div>
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
        </div>
        <button onClick={() => setIsCreateOpen(true)} className="btn btn-primary shrink-0">
          <UserPlus className="w-4 h-4" />
          Crear usuario
        </button>
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

      {isCreateOpen && (
        <CreateUserModal onClose={() => setIsCreateOpen(false)} onCreated={refresh} />
      )}
    </section>
  );
}
