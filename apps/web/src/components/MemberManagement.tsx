import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, X, Users, AlertTriangle } from 'lucide-react';
import { useMembers } from '../hooks/useMembers';
import type { ProjectRole } from '@project-workgroup/shared';

interface MemberManagementProps {
  projectId: string;
  isOwner?: boolean;
  onClose?: () => void;
}

// Rol global del usuario (candidatos de búsqueda vienen de /v1/users con UserRole, no ProjectRole)
const USER_ROLE_VARIANT: Record<string, 'err' | 'info' | 'ok' | 'outline'> = {
  admin: 'err',
  pm: 'info',
  member: 'ok',
};

const USER_ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  pm: 'PM',
  member: 'Miembro',
};

// Rol del miembro dentro del proyecto (ProjectRole real del backend)
const ROLE_VARIANT: Record<ProjectRole, 'err' | 'info' | 'ok' | 'outline'> = {
  manager: 'err',
  contributor: 'info',
  viewer: 'ok',
};

const ROLE_LABEL: Record<ProjectRole, string> = {
  manager: 'Gestor',
  contributor: 'Colaborador',
  viewer: 'Visor',
};

const ROLE_OPTIONS: ProjectRole[] = ['manager', 'contributor', 'viewer'];

const MemberManagement: React.FC<MemberManagementProps> = ({ projectId, isOwner = false, onClose }) => {
  const {
    members,
    searchResults,
    permissions,
    loading,
    searchLoading,
    error,
    searchUsers,
    addMember,
    removeMember,
    updateMemberRole,
    clearSearch,
  } = useMembers(projectId, isOwner);

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState<string | null>(null);
  const [isRemovingMember, setIsRemovingMember] = useState<string | null>(null);
  const [isChangingRole, setIsChangingRole] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (searchQuery.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        searchUsers({ query: searchQuery.trim(), limit: 3 });
        setShowSearchResults(true);
      }, 300);
    } else {
      clearSearch();
      setShowSearchResults(false);
    }
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery, searchUsers, clearSearch]);

  const handleAddMember = async (userId: string) => {
    setIsAddingMember(userId);
    try {
      await addMember(userId);
      setSearchQuery('');
      setShowSearchResults(false);
    } catch (err) {
      console.error('Error adding member:', err);
      alert(err instanceof Error ? err.message : 'Error al agregar miembro');
    } finally {
      setIsAddingMember(null);
    }
  };

  const handleRemoveMember = async (userId: string, memberName: string) => {
    if (!confirm(`¿Estás seguro de que quieres quitar a ${memberName} del proyecto?`)) return;
    setIsRemovingMember(userId);
    try {
      await removeMember(userId);
    } catch (err) {
      console.error('Error removing member:', err);
      alert(err instanceof Error ? err.message : 'Error al quitar miembro');
    } finally {
      setIsRemovingMember(null);
    }
  };

  const handleRoleChange = async (userId: string, projectRole: ProjectRole) => {
    setIsChangingRole(userId);
    try {
      await updateMemberRole(userId, projectRole);
    } catch (err) {
      console.error('Error changing member role:', err);
      alert(err instanceof Error ? err.message : 'Error al cambiar el rol');
    } finally {
      setIsChangingRole(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 gap-2" style={{ color: 'var(--ink-2)' }}>
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--p-500)' }} />
        <span>Cargando miembros...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 style={{ font: '500 var(--t-h3)/var(--lh-h3) var(--font-sans)', color: 'var(--ink)', margin: 0 }}>
            Miembros del proyecto
          </h3>
          <p style={{ font: '400 var(--t-small)/1.3 var(--font-sans)', color: 'var(--ink-2)', margin: '4px 0 0' }}>
            {members.length} miembro{members.length !== 1 ? 's' : ''}
          </p>
        </div>
        {onClose && (
          <button onClick={onClose} className="btn btn-ghost btn-icon btn-sm" aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        )}
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

      {permissions?.canAddMembers && (
        <div className="relative">
          <div className="input-wrap">
            <Search className="lead" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar usuarios para agregar..."
              className="input with-icon"
              style={{ paddingRight: 36 }}
            />
            {searchLoading && (
              <Loader2
                className="w-4 h-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--ink-3)' }}
              />
            )}
          </div>

          {showSearchResults && searchResults.length > 0 && (
            <div
              className="absolute z-10 w-full mt-1"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--r-md)',
                boxShadow: 'var(--sh-3)',
              }}
            >
              {searchResults.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between gap-3 p-3"
                  style={{ borderBottom: '1px solid var(--line)' }}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span
                      className="avatar"
                      style={{ background: 'var(--p-500)', color: 'var(--ink-on-primary)' }}
                    >
                      {u.displayName.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
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
                    <span className={`badge ${USER_ROLE_VARIANT[u.role] ?? 'outline'}`}>{USER_ROLE_LABEL[u.role] ?? u.role}</span>
                  </div>
                  <button
                    onClick={() => handleAddMember(u.id)}
                    disabled={isAddingMember === u.id}
                    className="btn btn-primary btn-sm"
                  >
                    {isAddingMember === u.id ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Agregando…
                      </>
                    ) : (
                      'Agregar'
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}

          {showSearchResults && searchQuery.length >= 2 && searchResults.length === 0 && !searchLoading && (
            <div
              className="absolute z-10 w-full mt-1 p-3 text-center"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--r-md)',
                boxShadow: 'var(--sh-3)',
                font: '400 var(--t-small)/1.3 var(--font-sans)',
                color: 'var(--ink-3)',
              }}
            >
              No se encontraron usuarios
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {members.length === 0 ? (
          <div className="empty">
            <div className="glyph">
              <Users className="w-6 h-6" />
            </div>
            <p style={{ font: '400 var(--t-small)/1.3 var(--font-sans)', color: 'var(--ink-2)', margin: 0 }}>
              No hay miembros en este proyecto
            </p>
          </div>
        ) : (
          members.map((m) => (
            <div
              key={m.userId}
              className="card flex items-center justify-between gap-3"
              style={{ padding: 'var(--s-3) var(--s-4)' }}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="avatar md" style={{ background: 'var(--p-500)', color: 'var(--ink-on-primary)' }}>
                  {m.displayName.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p style={{ font: '500 var(--t-small)/1.2 var(--font-sans)', color: 'var(--ink-1)', margin: 0 }}>
                    {m.displayName}
                  </p>
                  <p
                    className="truncate"
                    style={{ font: '400 var(--t-caption)/1.2 var(--font-mono)', color: 'var(--ink-3)', margin: '2px 0 0' }}
                  >
                    {m.email}
                  </p>
                </div>
                {permissions?.canChangeRoles ? (
                  <select
                    className="select"
                    value={m.role}
                    disabled={isChangingRole === m.userId}
                    onChange={(e) => handleRoleChange(m.userId, e.target.value as ProjectRole)}
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABEL[role]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className={`badge ${ROLE_VARIANT[m.role] ?? 'outline'}`}>{ROLE_LABEL[m.role] ?? m.role}</span>
                )}
              </div>

              {permissions?.canRemoveMembers && (
                <button
                  onClick={() => handleRemoveMember(m.userId, m.displayName)}
                  disabled={isRemovingMember === m.userId}
                  className="btn btn-danger btn-sm"
                >
                  {isRemovingMember === m.userId ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Quitando…
                    </>
                  ) : (
                    'Quitar'
                  )}
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {!permissions?.canAddMembers && !permissions?.canRemoveMembers && (
        <div
          className="flex items-center gap-2"
          style={{
            background: 'var(--warn-bg)',
            border: '1px solid var(--warn-line)',
            color: 'var(--warn-fg)',
            borderRadius: 'var(--r-md)',
            padding: 'var(--s-3) var(--s-4)',
            font: '400 var(--t-small)/var(--lh-small) var(--font-sans)',
          }}
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          No tienes permisos para gestionar miembros en este proyecto.
        </div>
      )}
    </div>
  );
};

export default MemberManagement;
