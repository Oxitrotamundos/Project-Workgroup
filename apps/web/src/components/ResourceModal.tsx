import React, { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';

interface ResourceModalInitial {
  name: string;
  email: string | null;
  discipline: string | null;
}

interface ResourceModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; email?: string; discipline?: string }) => Promise<void>;
  initial?: ResourceModalInitial;
  // Recursos kind === 'user' tienen name/email gestionados por el usuario vinculado; solo la disciplina es editable
  identityReadOnly?: boolean;
}

const ResourceModal: React.FC<ResourceModalProps> = ({ open, onClose, onSubmit, initial, identityReadOnly }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', discipline: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initial) {
      setFormData({
        name: initial.name,
        email: initial.email ?? '',
        discipline: initial.discipline ?? '',
      });
    } else {
      setFormData({ name: '', email: '', discipline: '' });
    }
    setErrors({});
  }, [initial, open]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'El nombre es requerido';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: 'name' | 'email' | 'discipline', value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    try {
      await onSubmit({
        name: formData.name.trim(),
        email: formData.email.trim() || undefined,
        discipline: formData.discipline.trim() || undefined,
      });
      onClose();
    } catch (error) {
      console.error('Error submitting resource:', error);
      setErrors({ submit: error instanceof Error ? error.message : 'Error al guardar el recurso. Inténtalo de nuevo.' });
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const inputClass = (field: string) => `input ${errors[field] ? 'border-err-line' : ''}`;
  const errorStyle: React.CSSProperties = {
    color: 'var(--err-fg)',
    font: '400 var(--t-caption)/1.3 var(--font-sans)',
    margin: '4px 0 0',
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="ttl">{initial ? 'Editar recurso' : 'Nuevo recurso'}</h2>
          <button onClick={onClose} className="btn btn-ghost btn-icon btn-sm" disabled={loading} aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="contents">
          <div className="modal-body space-y-4">
            <div className="field">
              <label htmlFor="name" className="field-label">Nombre *</label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={inputClass('name')}
                placeholder="Ej: Juan Pérez"
                disabled={loading || identityReadOnly}
              />
              {errors.name && <p style={errorStyle}>{errors.name}</p>}
            </div>

            <div className="field">
              <label htmlFor="email" className="field-label">Email</label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="input"
                placeholder="nombre@empresa.com"
                disabled={loading || identityReadOnly}
              />
            </div>

            <div className="field">
              <label htmlFor="discipline" className="field-label">Disciplina</label>
              <input
                type="text"
                id="discipline"
                value={formData.discipline}
                onChange={(e) => handleInputChange('discipline', e.target.value)}
                className="input"
                placeholder="Ej: Frontend, QA, Diseño…"
                disabled={loading}
              />
            </div>

            {errors.submit && (
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
                {errors.submit}
              </div>
            )}
          </div>

          <div className="modal-foot">
            <button type="button" onClick={onClose} className="btn btn-secondary" disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResourceModal;
