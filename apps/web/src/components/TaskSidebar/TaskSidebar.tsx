import React from 'react';
import { X, Save } from 'lucide-react';
import type { Task, TaskStatus, TaskPriority, TaskType } from '../../types/domain';
import { useProjectSettings } from '../../contexts/ProjectSettingsContext';
import './taskSidebar.css';

interface UpdatePatch {
  name?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  type?: TaskType;
  estimatedHours?: number;
  progress?: number;
  startDate?: string;
  endDate?: string;
}

interface Props {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onSave: (taskId: string, patch: UpdatePatch, expectedVersion?: number) => Promise<void>;
}

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'not-started', label: 'Pendiente' },
  { value: 'in-progress', label: 'En curso' },
  { value: 'blocked', label: 'Bloqueado' },
  { value: 'completed', label: 'Completada' },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
  { value: 'critical', label: 'Crítica' },
];

const TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: 'task', label: 'Tarea' },
  { value: 'summary', label: 'Resumen' },
  { value: 'milestone', label: 'Hito' },
];

const isoToDateInput = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

const isoToDateTimeInput = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${yyyy}-${mo}-${dd}T${hh}:${mm}`;
};

const inputToIso = (value: string): string | null => {
  if (!value) return null;
  if (value.includes('T')) {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
    if (!match) return null;
    const [, y, mo, d, h, mi] = match;
    return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi))).toISOString();
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, mo, d] = match;
  return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), 0, 0, 0)).toISOString();
};

const TaskSidebar: React.FC<Props> = ({ task, open, onClose, onSave }) => {
  const { isDays } = useProjectSettings();
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [status, setStatus] = React.useState<TaskStatus>('not-started');
  const [priority, setPriority] = React.useState<TaskPriority>('medium');
  const [taskType, setTaskType] = React.useState<TaskType>('task');
  const [estimatedHours, setEstimatedHours] = React.useState('');
  const [progress, setProgress] = React.useState('0');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!task) return;
    setName(task.name ?? '');
    setDescription(task.description ?? '');
    setStatus(task.status);
    setPriority(task.priority);
    setTaskType(task.type ?? 'task');
    setEstimatedHours(task.estimatedHours ? String(task.estimatedHours) : '');
    setProgress(String(task.progress ?? 0));
    setStartDate(isDays ? isoToDateInput(task.startDate) : isoToDateTimeInput(task.startDate));
    setEndDate(isDays ? isoToDateInput(task.endDate) : isoToDateTimeInput(task.endDate));
    setError(null);
  }, [task, isDays]);

  if (!open || !task) return null;

  const handleSave = async () => {
    if (!task) return;
    const patch: UpdatePatch = {};
    if (name.trim() && name !== task.name) patch.name = name.trim();
    if (description !== (task.description ?? '')) patch.description = description;
    if (status !== task.status) patch.status = status;
    if (priority !== task.priority) patch.priority = priority;
    if (taskType !== task.type) patch.type = taskType;
    if (!isDays) {
      const hoursNum = Number(estimatedHours);
      if (Number.isFinite(hoursNum) && hoursNum !== task.estimatedHours) patch.estimatedHours = hoursNum;
    }
    const progNum = Number(progress);
    if (Number.isFinite(progNum) && progNum !== (task.progress ?? 0)) {
      patch.progress = Math.max(0, Math.min(100, Math.round(progNum)));
    }
    const startIso = inputToIso(startDate);
    if (startIso && startIso !== new Date(task.startDate).toISOString()) patch.startDate = startIso;
    const endIso = inputToIso(endDate);
    if (endIso && endIso !== new Date(task.endDate).toISOString()) patch.endDate = endIso;
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(task.id, patch, task.version);
      onClose();
    } catch (e) {
      setError('No se pudo guardar. Intenta de nuevo.');
      console.error('TaskSidebar save error', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="ts-overlay"
        aria-label="Cerrar panel"
        onClick={onClose}
      />
      <aside className="ts-drawer" role="dialog" aria-label="Detalles de la tarea">
        <header className="ts-header">
          <h2 className="ts-title">Tarea</h2>
          <button type="button" onClick={onClose} className="ts-icon-btn" aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="ts-body">
          <label className="ts-field">
            <span className="ts-label">Nombre</span>
            <input
              className="ts-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre de la tarea"
            />
          </label>

          <label className="ts-field">
            <span className="ts-label">Descripción</span>
            <textarea
              className="ts-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Notas, contexto, criterios..."
            />
          </label>

          <div className="ts-grid">
            <label className="ts-field">
              <span className="ts-label">Estado</span>
              <select className="ts-input" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>

            <label className="ts-field">
              <span className="ts-label">Prioridad</span>
              <select className="ts-input" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="ts-field">
            <span className="ts-label">Tipo</span>
            <select className="ts-input" value={taskType} onChange={(e) => setTaskType(e.target.value as TaskType)}>
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          <div className="ts-grid">
            <label className="ts-field">
              <span className="ts-label">Inicio</span>
              <input
                className="ts-input"
                type={isDays ? 'date' : 'datetime-local'}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label className="ts-field">
              <span className="ts-label">Fin</span>
              <input
                className="ts-input"
                type={isDays ? 'date' : 'datetime-local'}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
          </div>

          <div className="ts-grid">
            {!isDays && (
              <label className="ts-field">
                <span className="ts-label">Horas estimadas</span>
                <input
                  className="ts-input"
                  type="number"
                  min={0}
                  step={0.5}
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value)}
                />
              </label>
            )}
            <label className="ts-field">
              <span className="ts-label">Progreso ({progress}%)</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={progress}
                onChange={(e) => setProgress(e.target.value)}
              />
            </label>
          </div>

          {error && <p className="ts-error">{error}</p>}
        </div>

        <footer className="ts-footer">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4" />
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </footer>
      </aside>
    </>
  );
};

export default TaskSidebar;
