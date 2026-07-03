import { useEffect, useRef, useState } from 'react';
import type { TaskPriority, TaskStatus, TaskType } from '../../types/domain';

export interface NewTaskInput {
  name: string;
  estimatedHours?: number;
  priority: TaskPriority;
  status: TaskStatus;
  type: TaskType;
  startDate?: string;
  assigneeId?: string;
}

export interface AssigneeOption {
  id: string;
  displayName: string;
  avatar?: string;
  discipline?: string;
}

interface Props {
  onConfirm: (input: NewTaskInput) => Promise<void> | void;
  onCancel: () => void;
  assignees?: AssigneeOption[];
}

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'critical'];
const STATUSES: TaskStatus[] = ['not-started', 'in-progress', 'completed', 'blocked'];
const TYPES: TaskType[] = ['task', 'summary', 'milestone'];

const today = (): string => new Date().toISOString().slice(0, 10);

const NewTaskRow: React.FC<Props> = ({ onConfirm, onCancel, assignees }) => {
  const [name, setName] = useState('');
  const [hours, setHours] = useState('');
  const [startDate, setStartDate] = useState(today());
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [status, setStatus] = useState<TaskStatus>('not-started');
  const [type, setType] = useState<TaskType>('task');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const canSubmit = name.trim().length > 0 && !saving;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const parsedHours = hours ? Number(hours) : undefined;
      await onConfirm({
        name: name.trim(),
        estimatedHours: parsedHours && parsedHours > 0 ? parsedHours : undefined,
        priority,
        status,
        type,
        startDate,
        assigneeId: assigneeId || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <tr className="tv-create-row">
      <td className="tv-create-cell">
        <select
          aria-label="Estado"
          className="tv-create-mini"
          value={status}
          onChange={(e) => setStatus(e.target.value as TaskStatus)}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace('-', ' ')}</option>
          ))}
        </select>
      </td>
      <td className="tv-create-cell">
        <input
          ref={inputRef}
          className="tv-create-input"
          placeholder="Nombre de la tarea…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={onKey}
          disabled={saving}
        />
        {assignees && assignees.length > 0 && (
          <select
            aria-label="Asignar a"
            className="tv-create-mini"
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            style={{ marginTop: 6, width: 'auto', minWidth: 140 }}
          >
            <option value="">Sin asignar</option>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>{a.displayName}</option>
            ))}
          </select>
        )}
      </td>
      <td className="tv-create-cell">
        <select
          aria-label="Prioridad"
          className="tv-create-mini"
          value={priority}
          onChange={(e) => setPriority(e.target.value as TaskPriority)}
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{p[0].toUpperCase()}</option>
          ))}
        </select>
      </td>
      <td className="tv-create-cell">
        <input
          type="date"
          aria-label="Fecha de inicio"
          className="tv-create-mini"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          style={{ textAlign: 'right' }}
        />
      </td>
      <td className="tv-create-cell">
        <select
          aria-label="Tipo"
          className="tv-create-mini"
          value={type}
          onChange={(e) => setType(e.target.value as TaskType)}
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </td>
      <td className="tv-create-cell">
        <input
          type="number"
          min="0"
          step="0.5"
          aria-label="Horas estimadas"
          className="tv-create-mini"
          placeholder="h"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          style={{ textAlign: 'right' }}
        />
      </td>
      <td className="tv-create-cell">
        <div className="tv-create-actions">
          <button
            type="button"
            className="tv-create-btn"
            data-variant="cancel"
            onClick={onCancel}
            disabled={saving}
            aria-label="Cancelar"
            title="Esc"
          >
            ✕
          </button>
          <button
            type="button"
            className="tv-create-btn"
            data-variant="confirm"
            onClick={submit}
            disabled={!canSubmit}
            aria-label="Confirmar"
            title="Enter"
          >
            ✓
          </button>
        </div>
      </td>
    </tr>
  );
};

export default NewTaskRow;
