import { useMemo, useState } from 'react';
import type { Task, TaskStatus, TaskPriority, TaskType } from '../../types/domain';
import InlineMenu from './InlineMenu';
import NewTaskRow from './NewTaskRow';
import type { NewTaskInput, AssigneeOption } from './NewTaskRow';
import { useProjectSettings } from '../../contexts/ProjectSettingsContext';

type SortKey = 'order' | 'name' | 'startDate' | 'endDate' | 'estimatedHours' | 'progress' | 'priority' | 'status';
type SortDir = 'asc' | 'desc';

type MenuTarget =
  | { kind: 'status'; taskId: string }
  | { kind: 'priority'; taskId: string }
  | null;

type HoursEdit = { taskId: string; value: string } | null;
type ProgressEdit = { taskId: string; value: string } | null;
type DateField = 'startDate' | 'endDate';
type DateEdit = { taskId: string; field: DateField; value: string } | null;

type InlinePatch = {
  status?: TaskStatus;
  priority?: TaskPriority;
  estimatedHours?: number;
  progress?: number;
  startDate?: string;
  endDate?: string;
  assigneeId?: string | null;
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  'not-started': 'Pendiente',
  'in-progress': 'En curso',
  'completed': 'Hecho',
  'blocked': 'Bloqueado',
};

const PRIORITY_LETTER: Record<TaskPriority, string> = {
  low: 'l',
  medium: 'm',
  high: 'h',
  critical: 'c',
};

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Crítica',
};

const TYPE_MARK: Record<TaskType, string | null> = {
  task: null,
  summary: 'sum',
  milestone: '◆',
};

const PRIORITY_ORDER: Record<TaskPriority, number> = { low: 0, medium: 1, high: 2, critical: 3 };
const STATUS_ORDER: Record<TaskStatus, number> = { 'not-started': 0, 'in-progress': 1, 'blocked': 2, 'completed': 3 };

const STATUS_OPTIONS = (['not-started', 'in-progress', 'completed', 'blocked'] as TaskStatus[]).map((value) => ({
  value,
  label: STATUS_LABEL[value],
  glyph: <span className="tv-pop-dot" data-status={value} />,
}));

const PRIORITY_OPTIONS = (['low', 'medium', 'high', 'critical'] as TaskPriority[]).map((value) => ({
  value,
  label: PRIORITY_LABEL[value],
  glyph: <span className="tv-pop-option-glyph" data-priority={value}>{PRIORITY_LETTER[value]}</span>,
}));

const formatDate = (iso: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = d.toLocaleString('es', { month: 'short', timeZone: 'UTC' }).replace('.', '');
  const year = String(d.getUTCFullYear()).slice(-2);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${day} ${month} ${year} ${hh}:${mm}`;
};

const isoToLocalInput = (iso: string): string => {
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

const localInputToIso = (value: string): string | null => {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s ?? 0)));
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
};

const isoToDateInput = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

const dateInputToIso = (value: string): string | null => {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, mo, d] = match;
  const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), 0, 0, 0));
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
};

const formatHours = (n: number | undefined): string => {
  if (!Number.isFinite(n ?? NaN)) return '—';
  const v = n as number;
  if (v === 0) return '0 h';
  return `${v.toLocaleString('es', { maximumFractionDigits: 1 })} h`;
};

// Iniciales (1-2 letras) a partir del nombre completo, para el avatar sin imagen
const getInitials = (displayName: string): string =>
  displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase() || '?';

interface TreeNode {
  task: Task;
  depth: number;
}

const buildOrderedTree = (tasks: Task[]): TreeNode[] => {
  const byParent = new Map<string, Task[]>();
  for (const t of tasks) {
    const key = t.parentId || '';
    const list = byParent.get(key) ?? [];
    list.push(t);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
  const out: TreeNode[] = [];
  const visit = (parentId: string, depth: number) => {
    const list = byParent.get(parentId) ?? [];
    for (const t of list) {
      out.push({ task: t, depth });
      visit(t.id, depth + 1);
    }
  };
  visit('', 0);
  return out;
};

const SortArrow: React.FC<{ active: boolean; dir: SortDir }> = ({ active, dir }) => (
  <span className="tv-th-arrow" data-active={active}>
    {active ? (dir === 'asc' ? '↑' : '↓') : '↕'}
  </span>
);

interface Props {
  tasks: Task[];
  onCreate?: (input: NewTaskInput) => Promise<void>;
  onUpdate?: (taskId: string, patch: InlinePatch, expectedVersion?: number) => Promise<void>;
  onSelectTask?: (taskId: string) => void;
  assignees?: AssigneeOption[];
}

const TaskListView: React.FC<Props> = ({ tasks, onCreate, onUpdate, onSelectTask, assignees }) => {
  const { isDays } = useProjectSettings();
  const [sortKey, setSortKey] = useState<SortKey>('order');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [creating, setCreating] = useState(false);
  const [menu, setMenu] = useState<MenuTarget>(null);
  const [hoursEdit, setHoursEdit] = useState<HoursEdit>(null);
  const [progressEdit, setProgressEdit] = useState<ProgressEdit>(null);
  const [dateEdit, setDateEdit] = useState<DateEdit>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const assigneesById = useMemo(() => {
    const m = new Map<string, AssigneeOption>();
    (assignees ?? []).forEach((a) => m.set(a.id, a));
    return m;
  }, [assignees]);

  const ordered = useMemo(() => {
    if (sortKey === 'order') return buildOrderedTree(tasks);
    const sorted = [...tasks].sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      switch (sortKey) {
        case 'name':
          return a.name.localeCompare(b.name) * mul;
        case 'startDate':
          return (new Date(a.startDate).getTime() - new Date(b.startDate).getTime()) * mul;
        case 'endDate':
          return (new Date(a.endDate).getTime() - new Date(b.endDate).getTime()) * mul;
        case 'estimatedHours':
          return ((a.estimatedHours ?? 0) - (b.estimatedHours ?? 0)) * mul;
        case 'progress':
          return ((a.progress ?? 0) - (b.progress ?? 0)) * mul;
        case 'priority':
          return (PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]) * mul;
        case 'status':
          return (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) * mul;
        default:
          return 0;
      }
    });
    return sorted.map<TreeNode>((task) => ({ task, depth: 0 }));
  }, [tasks, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const startCreate = () => {
    setError(null);
    setCreating(true);
  };

  const cancelCreate = () => setCreating(false);

  const confirmCreate = async (input: NewTaskInput) => {
    if (!onCreate) return;
    try {
      setError(null);
      await onCreate(input);
      setCreating(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la tarea');
    }
  };

  const markSaving = (taskId: string, on: boolean) => {
    setSavingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(taskId);
      else next.delete(taskId);
      return next;
    });
  };

  const applyPatch = async (task: Task, patch: InlinePatch) => {
    if (!onUpdate) return;
    markSaving(task.id, true);
    setError(null);
    try {
      await onUpdate(task.id, patch, task.version);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el cambio');
    } finally {
      markSaving(task.id, false);
    }
  };

  const startHoursEdit = (task: Task) => {
    if (!onUpdate) return;
    const current = task.estimatedHours ?? 0;
    setHoursEdit({ taskId: task.id, value: current ? String(current) : '' });
  };

  const commitHoursEdit = async (task: Task) => {
    if (!hoursEdit || hoursEdit.taskId !== task.id) return;
    const raw = hoursEdit.value.trim().replace(',', '.');
    setHoursEdit(null);
    if (raw === '') return;
    const next = Number(raw);
    if (!Number.isFinite(next) || next < 0) {
      setError('Las horas deben ser un número mayor o igual a 0');
      return;
    }
    const rounded = Math.round(next * 10) / 10;
    if (rounded === (task.estimatedHours ?? 0)) return;
    await applyPatch(task, { estimatedHours: rounded });
  };

  const startProgressEdit = (task: Task) => {
    if (!onUpdate) return;
    setProgressEdit({ taskId: task.id, value: String(task.progress ?? 0) });
  };

  const startDateEdit = (task: Task, field: DateField) => {
    if (!onUpdate || task.type === 'summary') return;
    const source = field === 'startDate' ? task.startDate : task.endDate;
    const initial = isDays ? isoToDateInput(source) : isoToLocalInput(source);
    setDateEdit({ taskId: task.id, field, value: initial });
  };

  const commitDateEdit = async (task: Task) => {
    if (!dateEdit || dateEdit.taskId !== task.id) return;
    const { field, value } = dateEdit;
    setDateEdit(null);
    if (!value) return;
    const iso = isDays ? dateInputToIso(value) : localInputToIso(value);
    if (!iso) {
      setError('Fecha inválida');
      return;
    }
    const currentIso = (field === 'startDate' ? task.startDate : task.endDate) ?? '';
    if (currentIso && new Date(currentIso).toISOString() === iso) return;
    await applyPatch(task, { [field]: iso } as InlinePatch);
  };

  const commitProgressEdit = async (task: Task) => {
    if (!progressEdit || progressEdit.taskId !== task.id) return;
    const raw = progressEdit.value.trim();
    setProgressEdit(null);
    if (raw === '') return;
    const next = Number(raw);
    if (!Number.isFinite(next)) {
      setError('El progreso debe ser un número entre 0 y 100');
      return;
    }
    const clamped = Math.max(0, Math.min(100, Math.round(next)));
    if (clamped === (task.progress ?? 0)) return;
    await applyPatch(task, { progress: clamped });
  };

  const renderCreateControl = (
    <div style={{ padding: '14px 32px 12px', display: 'flex', justifyContent: 'flex-end' }}>
      {!creating && onCreate && (
        <button type="button" className="tv-create-trigger" onClick={startCreate}>
          <span className="tv-create-trigger-glyph">+</span>
          Nueva entrada
        </button>
      )}
    </div>
  );

  if (!tasks.length && !creating) {
    return (
      <>
        {renderCreateControl}
        <div className="tv-empty">
          <p className="tv-empty-display">Aún sin tareas.</p>
          <p className="tv-empty-hint">Crea la primera con “Nueva entrada”</p>
        </div>
      </>
    );
  }

  return (
    <>
      {renderCreateControl}
      {error && <div className="tv-error" role="alert">{error}</div>}
      <div className="tv-body-scroll">
        <table className="tv-table">
          <thead className="tv-thead">
            <tr>
              <th className="tv-th tv-th-sortable" onClick={() => toggleSort('status')} style={{ width: 140 }}>
                Estado <SortArrow active={sortKey === 'status'} dir={sortDir} />
              </th>
              <th className="tv-th tv-th-sortable" onClick={() => toggleSort('name')}>
                Tarea <SortArrow active={sortKey === 'name'} dir={sortDir} />
              </th>
              <th className="tv-th tv-th--center" style={{ width: 120 }}>
                Responsable
              </th>
              <th className="tv-th tv-th--center tv-th-sortable" onClick={() => toggleSort('priority')} style={{ width: 64 }}>
                Prio <SortArrow active={sortKey === 'priority'} dir={sortDir} />
              </th>
              <th className="tv-th tv-th--right tv-th-sortable" onClick={() => toggleSort('startDate')} style={{ width: 160 }}>
                Inicio <SortArrow active={sortKey === 'startDate'} dir={sortDir} />
              </th>
              <th className="tv-th tv-th--right tv-th-sortable" onClick={() => toggleSort('endDate')} style={{ width: 160 }}>
                Fin <SortArrow active={sortKey === 'endDate'} dir={sortDir} />
              </th>
              {!isDays && (
                <th className="tv-th tv-th--right tv-th-sortable" onClick={() => toggleSort('estimatedHours')} style={{ width: 90 }}>
                  Horas <SortArrow active={sortKey === 'estimatedHours'} dir={sortDir} />
                </th>
              )}
              <th className="tv-th tv-th-sortable" onClick={() => toggleSort('progress')} style={{ width: 150 }}>
                Progreso <SortArrow active={sortKey === 'progress'} dir={sortDir} />
              </th>
            </tr>
          </thead>
          <tbody>
            {creating && <NewTaskRow onConfirm={confirmCreate} onCancel={cancelCreate} assignees={assignees} />}
            {ordered.map(({ task, depth }) => {
              const typeMark = TYPE_MARK[task.type];
              const isSaving = savingIds.has(task.id);
              const assignee = task.assigneeId ? assigneesById.get(task.assigneeId) : undefined;
              const assigneeTitle = assignee
                ? (assignee.discipline ? `${assignee.displayName} — ${assignee.discipline}` : assignee.displayName)
                : 'Sin asignar';
              return (
                <tr
                  key={task.id}
                  className="tv-tr"
                  data-type={task.type}
                  data-status={task.status}
                  data-completed={task.status === 'completed'}
                  data-saving={isSaving}
                >
                  <td className="tv-td">
                    <span className="tv-anchor">
                      <button
                        type="button"
                        className="tv-trigger"
                        onClick={() => setMenu(menu?.kind === 'status' && menu.taskId === task.id ? null : { kind: 'status', taskId: task.id })}
                        aria-label={`Cambiar estado, actual ${STATUS_LABEL[task.status]}`}
                      >
                        <span className="tv-status" data-status={task.status}>
                          <span className="tv-status-dot" />
                          <span>{STATUS_LABEL[task.status]}</span>
                        </span>
                      </button>
                      {menu?.kind === 'status' && menu.taskId === task.id && (
                        <InlineMenu<TaskStatus>
                          label="Estado"
                          current={task.status}
                          options={STATUS_OPTIONS}
                          onSelect={(v) => applyPatch(task, { status: v })}
                          onClose={() => setMenu(null)}
                        />
                      )}
                    </span>
                  </td>
                  <td className="tv-td">
                    <div className="tv-name-cell" style={{ paddingLeft: depth * 22 }}>
                      {depth > 0 && <span className="tv-indent-line" aria-hidden="true" />}
                      {onSelectTask ? (
                        <button
                          type="button"
                          className="tv-name tv-name-button"
                          title={`Abrir detalles de ${task.name}`}
                          onClick={() => onSelectTask(task.id)}
                        >
                          {task.name}
                        </button>
                      ) : (
                        <span className="tv-name" title={task.name}>{task.name}</span>
                      )}
                      {typeMark && (
                        <span className="tv-type-mark" data-type={task.type}>{typeMark}</span>
                      )}
                    </div>
                  </td>
                  <td className="tv-td tv-td--center">
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      {assignee?.avatar ? (
                        <img
                          src={assignee.avatar}
                          alt=""
                          title={assigneeTitle}
                          style={{ width: 24, height: 24, borderRadius: 999, objectFit: 'cover' }}
                        />
                      ) : assignee ? (
                        <span
                          title={assigneeTitle}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 24,
                            height: 24,
                            borderRadius: 999,
                            fontSize: 10,
                            fontWeight: 600,
                            background: 'var(--p-100)',
                            color: 'var(--p-700)',
                          }}
                        >
                          {getInitials(assignee.displayName)}
                        </span>
                      ) : (
                        <span title="Sin asignar" style={{ color: 'var(--ink-3)' }}>—</span>
                      )}
                      {onUpdate && assignees && assignees.length > 0 && (
                        <select
                          className="tv-create-mini"
                          aria-label={`Reasignar responsable de ${task.name}`}
                          value={task.assigneeId ?? ''}
                          onChange={(e) => applyPatch(task, { assigneeId: e.target.value || null })}
                          style={{ width: 'auto', minWidth: 96 }}
                        >
                          <option value="">Sin asignar</option>
                          {assignees.map((a) => (
                            <option key={a.id} value={a.id}>{a.displayName}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </td>
                  <td className="tv-td tv-td--center">
                    <span className="tv-anchor">
                      <button
                        type="button"
                        className="tv-trigger"
                        onClick={() => setMenu(menu?.kind === 'priority' && menu.taskId === task.id ? null : { kind: 'priority', taskId: task.id })}
                        aria-label={`Cambiar prioridad, actual ${PRIORITY_LABEL[task.priority]}`}
                      >
                        <span className="tv-priority" data-priority={task.priority}>
                          {PRIORITY_LETTER[task.priority]}
                        </span>
                      </button>
                      {menu?.kind === 'priority' && menu.taskId === task.id && (
                        <InlineMenu<TaskPriority>
                          label="Prioridad"
                          current={task.priority}
                          options={PRIORITY_OPTIONS}
                          onSelect={(v) => applyPatch(task, { priority: v })}
                          onClose={() => setMenu(null)}
                        />
                      )}
                    </span>
                  </td>
                  <td className="tv-td tv-td--mono tv-td--num">
                    {dateEdit?.taskId === task.id && dateEdit.field === 'startDate' ? (
                      <input
                        type={isDays ? 'date' : 'datetime-local'}
                        className="tv-date-input"
                        value={dateEdit.value}
                        autoFocus
                        onChange={(e) => setDateEdit({ taskId: task.id, field: 'startDate', value: e.target.value })}
                        onBlur={() => commitDateEdit(task)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            (e.currentTarget as HTMLInputElement).blur();
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            setDateEdit(null);
                          }
                        }}
                        aria-label="Editar fecha y hora de inicio"
                      />
                    ) : onUpdate && task.type !== 'summary' ? (
                      <button
                        type="button"
                        className="tv-trigger tv-date-trigger"
                        onClick={() => startDateEdit(task, 'startDate')}
                        aria-label={`Editar inicio, actual ${formatDate(task.startDate)}`}
                      >
                        {formatDate(task.startDate)}
                      </button>
                    ) : (
                      formatDate(task.startDate)
                    )}
                  </td>
                  <td className="tv-td tv-td--mono tv-td--num">
                    {dateEdit?.taskId === task.id && dateEdit.field === 'endDate' ? (
                      <input
                        type={isDays ? 'date' : 'datetime-local'}
                        className="tv-date-input"
                        value={dateEdit.value}
                        autoFocus
                        onChange={(e) => setDateEdit({ taskId: task.id, field: 'endDate', value: e.target.value })}
                        onBlur={() => commitDateEdit(task)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            (e.currentTarget as HTMLInputElement).blur();
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            setDateEdit(null);
                          }
                        }}
                        aria-label="Editar fecha y hora de fin"
                      />
                    ) : onUpdate && task.type !== 'summary' ? (
                      <button
                        type="button"
                        className="tv-trigger tv-date-trigger"
                        onClick={() => startDateEdit(task, 'endDate')}
                        aria-label={`Editar fin, actual ${formatDate(task.endDate)}`}
                      >
                        {formatDate(task.endDate)}
                      </button>
                    ) : (
                      formatDate(task.endDate)
                    )}
                  </td>
                  {!isDays && (
                    <td className="tv-td tv-td--num">
                      {hoursEdit?.taskId === task.id ? (
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          className="tv-hours-input"
                          value={hoursEdit.value}
                          autoFocus
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) => setHoursEdit({ taskId: task.id, value: e.target.value })}
                          onBlur={() => commitHoursEdit(task)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              (e.currentTarget as HTMLInputElement).blur();
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              setHoursEdit(null);
                            }
                          }}
                          aria-label="Editar horas estimadas"
                        />
                      ) : onUpdate ? (
                        <button
                          type="button"
                          className="tv-trigger tv-hours-trigger"
                          onClick={() => startHoursEdit(task)}
                          aria-label={`Editar horas, actual ${formatHours(task.estimatedHours)}`}
                        >
                          {formatHours(task.estimatedHours)}
                        </button>
                      ) : (
                        formatHours(task.estimatedHours)
                      )}
                    </td>
                  )}
                  <td className="tv-td">
                    {progressEdit?.taskId === task.id ? (
                      <div className="tv-progress tv-progress--editing">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          className="tv-progress-input"
                          value={progressEdit.value}
                          autoFocus
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) => setProgressEdit({ taskId: task.id, value: e.target.value })}
                          onBlur={() => commitProgressEdit(task)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              (e.currentTarget as HTMLInputElement).blur();
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              setProgressEdit(null);
                            }
                          }}
                          aria-label="Editar progreso (0-100)"
                        />
                        <span className="tv-progress-val">%</span>
                      </div>
                    ) : onUpdate ? (
                      <button
                        type="button"
                        className="tv-progress tv-progress-trigger"
                        onClick={() => startProgressEdit(task)}
                        aria-label={`Editar progreso, actual ${task.progress ?? 0}%`}
                      >
                        <span className="tv-progress-track">
                          <span
                            className="tv-progress-fill"
                            style={{ width: `${Math.max(0, Math.min(100, task.progress ?? 0))}%` }}
                          />
                        </span>
                        <span className="tv-progress-val">{task.progress ?? 0}%</span>
                      </button>
                    ) : (
                      <div className="tv-progress">
                        <span className="tv-progress-track">
                          <span
                            className="tv-progress-fill"
                            style={{ width: `${Math.max(0, Math.min(100, task.progress ?? 0))}%` }}
                          />
                        </span>
                        <span className="tv-progress-val">{task.progress ?? 0}%</span>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </>
  );
};

export default TaskListView;
