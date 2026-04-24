import { useEffect, useState } from 'react';
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
    if (!confirm('Revoke this key?')) return;
    await apiKeyService.revoke(id);
    await refresh();
  };

  return (
    <section className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">API keys</h1>

      {justCreated && (
        <div className="border-2 border-yellow-400 p-4 rounded">
          <p className="font-semibold mb-2">Copy this key now. You will not see it again.</p>
          <code className="block bg-gray-100 p-2 rounded break-all">{justCreated}</code>
          <button className="mt-2 underline" onClick={() => setJustCreated(null)}>Dismiss</button>
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="key name"
          className="border px-2 py-1 rounded flex-1"
        />
        <button onClick={onCreate} className="px-3 py-1 bg-blue-600 text-white rounded">Create</button>
      </div>

      {loading ? <p>Loading...</p> : (
        <ul className="divide-y">
          {keys.length === 0 && <li className="py-4 text-gray-500">No keys.</li>}
          {keys.map((k) => (
            <li key={k.id} className="py-3 flex items-center justify-between">
              <div>
                <p className="font-medium">{k.name}</p>
                <p className="text-sm text-gray-500">{k.prefix}... · last used {k.lastUsedAt ?? 'never'}</p>
              </div>
              <button onClick={() => onRevoke(k.id)} className="text-red-600">Revoke</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
