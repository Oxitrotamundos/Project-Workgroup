import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react';
import type {
  HolidayDto,
  UpsertCalendarDto,
  WorkingCalendarResponse,
  WorkingDayPatternDto,
} from '@project-workgroup/shared';
import { calendarService } from '../services/calendarService';
import { es } from '../locales/es';

const WEEKDAYS = es.calendar.dayNames;

type PatternState = {
  weekday: number;
  enabled: boolean;
  dayStart: string;
  breakStart: string;
  breakEnd: string;
  dayEnd: string;
};

const emptyPattern = (weekday: number): PatternState => ({
  weekday,
  enabled: false,
  dayStart: '',
  breakStart: '',
  breakEnd: '',
  dayEnd: '',
});

const toHhMm = (value: string | null | undefined): string => (value ? value.slice(0, 5) : '');

const fromCalendar = (cal: WorkingCalendarResponse): PatternState[] => {
  const byDay = new Map<number, PatternState>();
  for (const p of cal.patterns) {
    byDay.set(p.weekday, {
      weekday: p.weekday,
      enabled: p.enabled,
      dayStart: toHhMm(p.dayStart),
      breakStart: toHhMm(p.breakStart),
      breakEnd: toHhMm(p.breakEnd),
      dayEnd: toHhMm(p.dayEnd),
    });
  }
  return Array.from({ length: 7 }, (_, i) => byDay.get(i) ?? emptyPattern(i));
};

const toUpsert = (
  timezone: string,
  name: string,
  patterns: PatternState[],
  holidays: HolidayDto[],
): UpsertCalendarDto => ({
  name: name || undefined,
  timezone,
  patterns: patterns.map<WorkingDayPatternDto>((p) => ({
    weekday: p.weekday,
    enabled: p.enabled,
    dayStart: p.enabled && p.dayStart ? `${p.dayStart}:00` : null,
    breakStart: p.enabled && p.breakStart ? `${p.breakStart}:00` : null,
    breakEnd: p.enabled && p.breakEnd ? `${p.breakEnd}:00` : null,
    dayEnd: p.enabled && p.dayEnd ? `${p.dayEnd}:00` : null,
  })),
  holidays,
});

const alertStyle = (variant: 'ok' | 'err' | 'warn' | 'info'): React.CSSProperties => ({
  background: `var(--${variant}-bg)`,
  border: `1px solid var(--${variant}-line)`,
  color: `var(--${variant}-fg)`,
  borderRadius: 'var(--r-md)',
  padding: 'var(--s-3) var(--s-4)',
  font: '400 var(--t-small)/var(--lh-small) var(--font-sans)',
});

const sectionFrameStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r-lg)',
  overflow: 'hidden',
};

const sectionHeadStyle: React.CSSProperties = {
  padding: 'var(--s-3) var(--s-4)',
  borderBottom: '1px solid var(--line)',
  background: 'var(--surface-2)',
  font: '500 var(--t-eyebrow)/1 var(--font-mono)',
  letterSpacing: 'var(--tr-eyebrow)',
  textTransform: 'uppercase',
  color: 'var(--ink-3)',
};

const sectionFootStyle: React.CSSProperties = {
  padding: 'var(--s-3) var(--s-4)',
  borderTop: '1px solid var(--line)',
  background: 'var(--surface-2)',
  font: '400 var(--t-caption)/1.4 var(--font-mono)',
  color: 'var(--ink-3)',
};

export default function CalendarSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [calendar, setCalendar] = useState<WorkingCalendarResponse | null>(null);
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('America/Lima');
  const [patterns, setPatterns] = useState<PatternState[]>(() =>
    Array.from({ length: 7 }, (_, i) => emptyPattern(i)),
  );
  const [holidays, setHolidays] = useState<HolidayDto[]>([]);
  const [newHoliday, setNewHoliday] = useState<HolidayDto>({ date: '', label: '', recurringYearly: false });

  const isGlobalMode = !projectId;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const cal = isGlobalMode
        ? await calendarService.getGlobal()
        : await calendarService.getForProject(projectId!);
      if (cancelled) return;
      if (cal) {
        setCalendar(cal);
        setName(cal.name);
        setTimezone(cal.timezone);
        setPatterns(fromCalendar(cal));
        setHolidays(cal.holidays.map((h) => ({ ...h })));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, isGlobalMode]);

  const updatePattern = (weekday: number, patch: Partial<PatternState>) => {
    setPatterns((prev) => prev.map((p) => (p.weekday === weekday ? { ...p, ...patch } : p)));
  };

  const addHoliday = () => {
    if (!newHoliday.date || !newHoliday.label) return;
    setHolidays((prev) => [...prev, newHoliday]);
    setNewHoliday({ date: '', label: '', recurringYearly: false });
  };

  const removeHoliday = (idx: number) => {
    setHolidays((prev) => prev.filter((_, i) => i !== idx));
  };

  const save = async () => {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const dto = toUpsert(timezone, name, patterns, holidays);
      const updated = isGlobalMode
        ? await calendarService.upsertGlobal(dto)
        : await calendarService.upsertForProject(projectId!, dto);
      setCalendar(updated);
      setSuccess(
        isGlobalMode
          ? `Calendario global guardado (${updated.hoursPerDay} h/día). Las tareas heredadas se reagendaron automáticamente.`
          : `Guardado (${updated.hoursPerDay} h/día efectivas). Tareas del proyecto reagendadas.`,
      );
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo guardar el calendario');
    } finally {
      setSaving(false);
    }
  };

  const resetToGlobal = async () => {
    if (!projectId) return;
    if (!confirm('Esto elimina el calendario de este proyecto y vuelve a usar el global. ¿Continuar?')) return;
    setSaving(true);
    setError(null);
    try {
      await calendarService.deleteProjectOverride(projectId);
      const fresh = await calendarService.getForProject(projectId);
      if (fresh) {
        setCalendar(fresh);
        setName(fresh.name);
        setTimezone(fresh.timezone);
        setPatterns(fromCalendar(fresh));
        setHolidays(fresh.holidays.map((h) => ({ ...h })));
        setSuccess('Override eliminado. Ahora se usa el calendario global.');
      }
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo eliminar el override');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6" style={{ color: 'var(--ink-2)' }}>Cargando calendario…</div>;
  }

  const isOverride = !isGlobalMode && calendar?.scope === 'project' && calendar.projectId === projectId;
  const backLink = isGlobalMode ? '/settings' : `/project/${projectId}`;
  const backLabel = isGlobalMode ? 'Volver a configuración' : 'Volver al proyecto';
  const subtitle = isGlobalMode
    ? 'Calendario global. Es el default para todos los proyectos sin override propio.'
    : isOverride
      ? 'Este proyecto usa un calendario propio.'
      : 'Este proyecto hereda el calendario global. Guarda cambios para crear un override.';

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow" style={{ marginBottom: 'var(--s-2)' }}>
            {isGlobalMode ? 'Global' : 'Proyecto'}
          </p>
          <h1
            style={{
              font: '500 var(--t-h1)/var(--lh-h1) var(--font-sans)',
              letterSpacing: 'var(--tr-h1)',
              color: 'var(--ink)',
              margin: 0,
            }}
          >
            Calendario laboral
          </h1>
          <p
            style={{
              font: '400 var(--t-small)/var(--lh-small) var(--font-sans)',
              color: 'var(--ink-2)',
              margin: 'var(--s-2) 0 0',
              maxWidth: '60ch',
            }}
          >
            {subtitle}
          </p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(backLink)}>
          <ChevronLeft className="w-4 h-4" />
          {backLabel}
        </button>
      </div>

      {error && <div style={alertStyle('err')}>{error}</div>}
      {success && <div style={alertStyle('ok')}>{success}</div>}

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="field">
          <label className="field-label">Nombre</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Estándar Lima"
          />
        </div>
        <div className="field">
          <label className="field-label">Zona horaria (IANA)</label>
          <input
            className="input"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="America/Lima"
          />
        </div>
      </section>

      <section style={sectionFrameStyle}>
        <header style={sectionHeadStyle}>Jornada semanal</header>
        <div>
          {patterns.map((p, i) => (
            <div
              key={p.weekday}
              className="grid grid-cols-12 gap-2 items-center"
              style={{
                padding: 'var(--s-3) var(--s-4)',
                borderTop: i === 0 ? 'none' : '1px solid var(--line)',
              }}
            >
              <label className="col-span-3 flex items-center gap-2" style={{ font: '400 var(--t-small)/1 var(--font-sans)', color: 'var(--ink-1)' }}>
                <button
                  type="button"
                  className={`switch ${p.enabled ? 'on' : ''}`}
                  onClick={() => updatePattern(p.weekday, { enabled: !p.enabled })}
                  aria-label={`${p.enabled ? 'Deshabilitar' : 'Habilitar'} ${WEEKDAYS[p.weekday]}`}
                />
                <span>{WEEKDAYS[p.weekday]}</span>
              </label>
              <input
                type="time"
                className="input col-span-2"
                disabled={!p.enabled}
                value={p.dayStart}
                onChange={(e) => updatePattern(p.weekday, { dayStart: e.target.value })}
              />
              <input
                type="time"
                className="input col-span-2"
                disabled={!p.enabled}
                value={p.breakStart}
                onChange={(e) => updatePattern(p.weekday, { breakStart: e.target.value })}
              />
              <input
                type="time"
                className="input col-span-2"
                disabled={!p.enabled}
                value={p.breakEnd}
                onChange={(e) => updatePattern(p.weekday, { breakEnd: e.target.value })}
              />
              <input
                type="time"
                className="input col-span-2"
                disabled={!p.enabled}
                value={p.dayEnd}
                onChange={(e) => updatePattern(p.weekday, { dayEnd: e.target.value })}
              />
              <div
                className="col-span-1 text-right"
                style={{ font: '400 var(--t-caption)/1 var(--font-mono)', color: 'var(--ink-4)' }}
              >
                {p.enabled ? '' : 'libre'}
              </div>
            </div>
          ))}
        </div>
        <footer style={sectionFootStyle}>
          Encabezado: día | inicio | inicio almuerzo | fin almuerzo | fin. La pausa de almuerzo se descuenta automáticamente.
        </footer>
      </section>

      <section style={sectionFrameStyle}>
        <header style={sectionHeadStyle}>Festivos</header>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {holidays.length === 0 && (
            <li
              style={{
                padding: 'var(--s-4)',
                font: '400 var(--t-small)/1.4 var(--font-sans)',
                color: 'var(--ink-3)',
              }}
            >
              Sin festivos configurados.
            </li>
          )}
          {holidays.map((h, idx) => (
            <li
              key={`${h.date}-${idx}`}
              className="flex items-center gap-3"
              style={{
                padding: 'var(--s-2) var(--s-4)',
                borderTop: idx === 0 ? 'none' : '1px solid var(--line)',
                font: '400 var(--t-small)/1.3 var(--font-sans)',
                color: 'var(--ink-1)',
              }}
            >
              <span style={{ font: '500 var(--t-mono)/1 var(--font-mono)', color: 'var(--ink-1)', minWidth: 90 }}>
                {h.date}
              </span>
              <span className="flex-1">{h.label}</span>
              {h.recurringYearly && <span className="badge outline">Anual</span>}
              <button
                type="button"
                onClick={() => removeHoliday(idx)}
                className="btn btn-ghost btn-icon btn-sm"
                style={{ color: 'var(--err-fg)' }}
                aria-label="Quitar"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <div
          className="grid grid-cols-12 gap-2 items-center"
          style={{ padding: 'var(--s-3) var(--s-4)', borderTop: '1px solid var(--line)' }}
        >
          <input
            type="date"
            className="input col-span-3"
            value={newHoliday.date}
            onChange={(e) => setNewHoliday((h) => ({ ...h, date: e.target.value }))}
          />
          <input
            className="input col-span-6"
            placeholder="Etiqueta (ej. Día del Trabajo)"
            value={newHoliday.label}
            onChange={(e) => setNewHoliday((h) => ({ ...h, label: e.target.value }))}
          />
          <label
            className="col-span-2 flex items-center gap-2"
            style={{ font: '400 var(--t-caption)/1 var(--font-sans)', color: 'var(--ink-2)' }}
          >
            <button
              type="button"
              className={`switch ${newHoliday.recurringYearly ? 'on' : ''}`}
              onClick={() => setNewHoliday((h) => ({ ...h, recurringYearly: !h.recurringYearly }))}
              aria-label="Anual"
            />
            Anual
          </label>
          <button
            type="button"
            className="btn btn-primary btn-icon btn-sm col-span-1"
            onClick={addHoliday}
            aria-label="Añadir festivo"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={saving} className="btn btn-primary">
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
        {isOverride && (
          <button type="button" onClick={resetToGlobal} disabled={saving} className="btn btn-secondary">
            Volver al calendario global
          </button>
        )}
      </div>
    </div>
  );
}
