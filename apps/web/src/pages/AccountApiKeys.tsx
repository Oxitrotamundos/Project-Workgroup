import { useEffect, useState } from 'react';
import { Plus, AlertTriangle } from 'lucide-react';
import { apiKeyService } from '../services/apiKeyService';
import type { ApiKeyResponse } from '@project-workgroup/shared';

export default function AccountApiKeys() {
  const [keys, setKeys] = useState<ApiKeyResponse[]>([]);
  const [name, setName] = useState('');
  const [justCreated, setJustCreated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = () => apiKeyService.list().then(setKeys).finally(() => setLoading(false));
  useEffect(() => { refresh(); }, []);

  const onCreate = async () => {
    if (!name.trim()) return;
    const created = await apiKeyService.create(name.trim());
    setJustCreated(created.plaintext);
    setName('');
    await refresh();
  };

  const onRevoke = async (id: string) => {
    if (!confirm('¿Revocar esta clave?')) return;
    await apiKeyService.revoke(id);
    await refresh();
  };

  return (
    <section className="max-w-3xl mx-auto p-6 sm:p-8 space-y-6">
      <header>
        <p className="eyebrow" style={{ marginBottom: 'var(--s-2)' }}>Cuenta</p>
        <h1
          style={{
            font: '500 var(--t-h1)/var(--lh-h1) var(--font-sans)',
            letterSpacing: 'var(--tr-h1)',
            color: 'var(--ink)',
            margin: 0,
          }}
        >
          API keys
        </h1>
        <p
          style={{
            font: '400 var(--t-small)/var(--lh-small) var(--font-sans)',
            color: 'var(--ink-2)',
            margin: 'var(--s-2) 0 0',
          }}
        >
          Tokens para integraciones externas y agentes.
        </p>
      </header>

      {justCreated && (
        <div
          style={{
            background: 'var(--warn-bg)',
            border: '1px solid var(--warn-line)',
            borderRadius: 'var(--r-lg)',
            padding: 'var(--s-4)',
          }}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" style={{ color: 'var(--warn-fg)' }} />
            <div className="flex-1">
              <p
                style={{
                  font: '500 var(--t-small)/1.3 var(--font-sans)',
                  color: 'var(--warn-fg)',
                  margin: '0 0 var(--s-2)',
                }}
              >
                Copia esta clave ahora. No la verás de nuevo.
              </p>
              <code
                className="block break-all"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--r-sm)',
                  padding: 'var(--s-3)',
                  font: '400 var(--t-mono)/var(--lh-mono) var(--font-mono)',
                  color: 'var(--ink-1)',
                }}
              >
                {justCreated}
              </code>
              <button className="btn btn-ghost btn-sm mt-2" onClick={() => setJustCreated(null)}>
                Descartar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre de la clave"
          className="input flex-1"
        />
        <button onClick={onCreate} className="btn btn-primary" disabled={!name.trim()}>
          <Plus className="w-4 h-4" />
          Crear
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--ink-2)', font: '400 var(--t-small)/var(--lh-small) var(--font-sans)' }}>
          Cargando…
        </p>
      ) : (
        <div className="surface-table">
          <table className="tbl">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Prefijo</th>
                <th>Último uso</th>
                <th style={{ width: 100 }}>{' '}</th>
              </tr>
            </thead>
            <tbody>
              {keys.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--ink-3)', padding: 'var(--s-7)' }}>
                    No hay claves todavía.
                  </td>
                </tr>
              )}
              {keys.map((k) => (
                <tr key={k.id}>
                  <td style={{ fontWeight: 500 }}>{k.name}</td>
                  <td style={{ font: '400 var(--t-mono)/1 var(--font-mono)', color: 'var(--ink-2)' }}>
                    {k.prefix}…
                  </td>
                  <td style={{ font: '400 var(--t-mono)/1 var(--font-mono)', color: 'var(--ink-3)' }}>
                    {k.lastUsedAt ?? 'nunca'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button onClick={() => onRevoke(k.id)} className="btn btn-danger btn-sm">
                      Revocar
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
