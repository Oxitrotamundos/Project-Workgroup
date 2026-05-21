import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import type { Project, CreateProjectData, UpdateProjectData, ProjectStatus } from '../types/domain';
import { useAuth } from '../contexts/AuthContext';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateProjectData | UpdateProjectData) => Promise<void>;
  project?: Project | null;
  mode: 'create' | 'edit';
}

const PROJECT_COLORS = [
  '#059669', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#F97316', '#06B6D4', '#84CC16',
  '#EC4899', '#6B7280',
];

const ProjectModal: React.FC<ProjectModalProps> = ({ isOpen, onClose, onSubmit, project, mode }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    status: 'planning' as ProjectStatus,
    color: '#059669',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (mode === 'edit' && project) {
      setFormData({
        name: project.name,
        description: project.description,
        startDate: new Date(project.startDate).toISOString().split('T')[0],
        endDate: new Date(project.endDate).toISOString().split('T')[0],
        status: project.status,
        color: project.color,
      });
    } else {
      const today = new Date();
      const nextMonth = new Date(today);
      nextMonth.setMonth(today.getMonth() + 1);
      setFormData({
        name: '',
        description: '',
        startDate: today.toISOString().split('T')[0],
        endDate: nextMonth.toISOString().split('T')[0],
        status: 'planning',
        color: '#059669',
      });
    }
    setErrors({});
  }, [mode, project, isOpen]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'El nombre del proyecto es requerido';
    else if (formData.name.trim().length < 3) newErrors.name = 'El nombre debe tener al menos 3 caracteres';
    if (!formData.startDate) newErrors.startDate = 'La fecha de inicio es requerida';
    if (!formData.endDate) newErrors.endDate = 'La fecha de fin es requerida';
    if (formData.startDate && formData.endDate) {
      const startDate = new Date(formData.startDate);
      const endDate = new Date(formData.endDate);
      if (endDate <= startDate) newErrors.endDate = 'La fecha de fin debe ser posterior a la fecha de inicio';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !user) return;
    setLoading(true);
    try {
      const projectData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        startDate: formData.startDate,
        endDate: formData.endDate,
        status: formData.status,
        color: formData.color,
        ...(mode === 'create' && {
          ownerId: user.uid,
          members: [user.uid],
        }),
      };
      await onSubmit(projectData);
      onClose();
    } catch (error) {
      console.error('Error submitting project:', error);
      setErrors({ submit: 'Error al guardar el proyecto. Por favor, inténtalo de nuevo.' });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  if (!isOpen) return null;

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
          <h2 className="ttl">{mode === 'create' ? 'Crear Nuevo Proyecto' : 'Editar Proyecto'}</h2>
          <button onClick={onClose} className="btn btn-ghost btn-icon btn-sm" disabled={loading} aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="contents">
          <div className="modal-body space-y-4">
            <div className="field">
              <label htmlFor="name" className="field-label">Nombre del Proyecto *</label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={inputClass('name')}
                placeholder="Ej: Desarrollo de aplicación móvil"
                disabled={loading}
              />
              {errors.name && <p style={errorStyle}>{errors.name}</p>}
            </div>

            <div className="field">
              <label htmlFor="description" className="field-label">Descripción</label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={3}
                className="textarea"
                placeholder="Describe brevemente el proyecto..."
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="field">
                <label htmlFor="startDate" className="field-label">Fecha de Inicio *</label>
                <input
                  type="date"
                  id="startDate"
                  value={formData.startDate}
                  onChange={(e) => handleInputChange('startDate', e.target.value)}
                  className={inputClass('startDate')}
                  disabled={loading}
                />
                {errors.startDate && <p style={errorStyle}>{errors.startDate}</p>}
              </div>

              <div className="field">
                <label htmlFor="endDate" className="field-label">Fecha de Fin *</label>
                <input
                  type="date"
                  id="endDate"
                  value={formData.endDate}
                  onChange={(e) => handleInputChange('endDate', e.target.value)}
                  className={inputClass('endDate')}
                  disabled={loading}
                />
                {errors.endDate && <p style={errorStyle}>{errors.endDate}</p>}
              </div>
            </div>

            <div className="field">
              <label htmlFor="status" className="field-label">Estado</label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                className="select"
                disabled={loading}
              >
                <option value="planning">Planificación</option>
                <option value="active">Activo</option>
                <option value="on-hold">En Pausa</option>
                <option value="completed">Completado</option>
              </select>
            </div>

            <div className="field">
              <span className="field-label">Color del Proyecto</span>
              <div className="flex flex-wrap gap-2">
                {PROJECT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => handleInputChange('color', color)}
                    className="transition-transform"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '999px',
                      backgroundColor: color,
                      border: formData.color === color ? '2px solid var(--ink-1)' : '2px solid var(--line)',
                      transform: formData.color === color ? 'scale(1.1)' : 'scale(1)',
                      cursor: 'pointer',
                    }}
                    disabled={loading}
                    title={color}
                  />
                ))}
              </div>
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
              {mode === 'create' ? 'Crear Proyecto' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectModal;
