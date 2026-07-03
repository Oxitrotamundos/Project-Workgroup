import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, Loader2, X, AlertTriangle } from 'lucide-react';
import { useResources } from '../hooks/useResources';
import { UserService } from '../services/userService';
import ResourceModal from '../components/ResourceModal';
import type { ResourceResponse } from '@project-workgroup/shared';
import type { User } from '../types/domain';

// Modal de vinculación: busca usuarios (mismo patrón de debounce que MemberManagement) y liga el elegido al recurso placeholder
interface LinkUserModalProps {
  resource: ResourceResponse;
  onClose: () => void;
  onLink: (userId: string) => Promise<void>;
}

const LinkUserModal: React.FC<LinkUserModalProps> = ({ resource, onClose, onLink }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearchLoading(true);
    timeoutRef.current = setTimeout(async () => {
      try {
        const users = await UserService.searchUsersByEmail(query.trim());
        setResults(users);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [query]);

  const handleLink = async (userId: string) => {
    setLinkingId(userId);
    try {
      await onLink(userId);
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al vincular usuario');
    } finally {
      setLinkingId(null);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="ttl">Vincular a usuario</h2>
          <button onClick={onClose} className="btn btn-ghost btn-icon btn-sm" aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="modal-body space-y-4">
          <p style={{ font: '400 var(--t-small)/1.3 var(--font-sans)', color: 'var(--ink-2)', margin: 0 }}>
            Vincular <strong>{resource.name}</strong> a una cuenta de usuario existente.
          </p>
          <div className="input-wrap">
            <Search className="lead" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar usuarios por nombre o email…"
              className="input with-icon"
            />
            {searchLoading && (
              <Loader2
                className="w-4 h-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--ink-3)' }}
              />
            )}
          </div>

          <div className="space-y-2">
            {query.trim().length >= 2 && !searchLoading && results.length === 0 && (
              <p style={{ font: '400 var(--t-small)/1.3 var(--font-sans)', color: 'var(--ink-3)', textAlign: 'center', margin: 0 }}>
                No se encontraron usuarios
              </p>
            )}
            {results.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between gap-3 p-3"
                style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-md)' }}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="avatar" style={{ background: 'var(--p-500)', color: 'var(--ink-on-primary)' }}>
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
                </div>
                <button
                  onClick={() => handleLink(u.id)}
                  disabled={linkingId === u.id}
                  className="btn btn-primary btn-sm"
                >
                  {linkingId === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Vincular'}
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" onClick={onClose} className="btn btn-secondary">Cerrar</button>
        </div>
      </div>
    </div>
  );
};

const KIND_LABEL: Record<ResourceResponse['kind'], string> = {
  user: 'Usuario',
  placeholder: 'Placeholder',
};

export default function AdminResources() {
  const { resources, loading, error, create, update, linkUser, remove } = useResources({});
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ResourceResponse | null>(null);
  const [linkingResource, setLinkingResource] = useState<ResourceResponse | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const filteredResources = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return resources;
    return resources.filter((r) =>
      r.name.toLowerCase().includes(q) || (r.email ?? '').toLowerCase().includes(q)
    );
  }, [resources, searchQuery]);

  const openCreateModal = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEditModal = (resource: ResourceResponse) => {
    setEditing(resource);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const handleModalSubmit = async (data: { name: string; email?: string; discipline?: string }) => {
    if (editing) {
      // Los recursos de kind 'user' tienen name/email gestionados por la identidad vinculada; solo la disciplina es editable
      const dto = editing.kind === 'user' ? { discipline: data.discipline } : data;
      await update(editing.id, dto);
    } else {
      await create(data);
    }
  };

  const handleToggleStatus = async (resource: ResourceResponse) => {
    setActionError(null);
    setPendingId(resource.id);
    try {
      await update(resource.id, { status: resource.status === 'active' ? 'inactive' : 'active' });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Error al actualizar el estado');
    } finally {
      setPendingId(null);
    }
  };

  const handleRemove = async (resource: ResourceResponse) => {
    if (!confirm(`¿Eliminar el recurso "${resource.name}"?`)) return;
    setActionError(null);
    setPendingId(resource.id);
    try {
      await remove(resource.id);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Error al eliminar el recurso');
    } finally {
      setPendingId(null);
    }
  };

  const handleLink = async (userId: string) => {
    if (!linkingResource) return;
    await linkUser(linkingResource.id, userId);
  };

  return (
    <section className="max-w-5xl mx-auto p-6 sm:p-8 space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
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
            Recursos
          </h1>
          <p
            style={{
              font: '400 var(--t-small)/var(--lh-small) var(--font-sans)',
              color: 'var(--ink-2)',
              margin: 'var(--s-2) 0 0',
            }}
          >
            Personas y placeholders asignables a tareas y workload.
          </p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary">
          <Plus className="w-4 h-4" />
          Nuevo recurso
        </button>
      </header>

      <div className="input-wrap max-w-sm">
        <Search className="lead" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por nombre o email…"
          className="input with-icon"
        />
      </div>

      {(error || actionError) && (
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
            {actionError ?? error}
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
                <th>Recurso</th>
                <th style={{ width: 120 }}>Tipo</th>
                <th style={{ width: 140 }}>Disciplina</th>
                <th style={{ width: 110 }}>Estado</th>
                <th style={{ width: 280 }}>{' '}</th>
              </tr>
            </thead>
            <tbody>
              {filteredResources.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--ink-3)', padding: 'var(--s-7)' }}>
                    No hay recursos que coincidan con la búsqueda.
                  </td>
                </tr>
              )}
              {filteredResources.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="avatar" style={{ background: 'var(--p-500)', color: 'var(--ink-on-primary)' }}>
                        {r.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p style={{ font: '500 var(--t-small)/1.2 var(--font-sans)', color: 'var(--ink-1)', margin: 0 }}>
                          {r.name}
                        </p>
                        {r.email && (
                          <p
                            className="truncate"
                            style={{ font: '400 var(--t-caption)/1.2 var(--font-mono)', color: 'var(--ink-3)', margin: '2px 0 0' }}
                          >
                            {r.email}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${r.kind === 'user' ? 'info' : 'outline'}`}>{KIND_LABEL[r.kind]}</span>
                  </td>
                  <td style={{ color: 'var(--ink-2)' }}>{r.discipline ?? '—'}</td>
                  <td>
                    <span className={`badge ${r.status === 'active' ? 'ok' : 'warn'}`}>
                      {r.status === 'active' ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-2 flex-wrap">
                      <button onClick={() => openEditModal(r)} className="btn btn-secondary btn-sm">
                        Editar
                      </button>
                      <button
                        onClick={() => handleToggleStatus(r)}
                        disabled={pendingId === r.id}
                        className="btn btn-secondary btn-sm"
                      >
                        {r.status === 'active' ? 'Desactivar' : 'Activar'}
                      </button>
                      {r.kind === 'placeholder' && (
                        <button onClick={() => setLinkingResource(r)} className="btn btn-secondary btn-sm">
                          Vincular a usuario
                        </button>
                      )}
                      {r.kind === 'placeholder' && (
                        <button
                          onClick={() => handleRemove(r)}
                          disabled={pendingId === r.id}
                          className="btn btn-danger btn-sm"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ResourceModal
        open={modalOpen}
        onClose={closeModal}
        onSubmit={handleModalSubmit}
        initial={editing ? { name: editing.name, email: editing.email, discipline: editing.discipline } : undefined}
        identityReadOnly={editing?.kind === 'user'}
      />

      {linkingResource && (
        <LinkUserModal
          resource={linkingResource}
          onClose={() => setLinkingResource(null)}
          onLink={handleLink}
        />
      )}
    </section>
  );
}
