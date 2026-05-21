import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Clock, CalendarRange } from 'lucide-react';
import {
  useProjectSettingsQuery,
  useUpdateProjectSettingsMutation,
} from '../hooks/queries/useProjectSettings';
import type { TimeGranularity } from '@project-workgroup/shared';

const ProjectSettingsPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { data: settings, isLoading } = useProjectSettingsQuery(projectId);
  const updateSettings = useUpdateProjectSettingsMutation(projectId);

  const current: TimeGranularity = settings?.timeGranularity ?? 'hours';

  const onChange = (next: TimeGranularity) => {
    if (next === current) return;
    updateSettings.mutate({ timeGranularity: next });
  };

  return (
    <div className="flex-1 p-4 sm:p-6">
      <div
        className="max-w-3xl mx-auto"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-xl)',
          boxShadow: 'var(--sh-1)',
          padding: 'var(--s-5)',
        }}
      >
        <button
          type="button"
          className="btn btn-ghost btn-sm mb-4"
          onClick={() => projectId && navigate(`/project/${projectId}`)}
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Volver al proyecto</span>
        </button>

        <h1
          style={{
            font: '600 var(--t-h1)/var(--lh-h1) var(--font-sans)',
            marginBottom: 'var(--s-4)',
          }}
        >
          Ajustes del proyecto
        </h1>

        <section className="mb-6">
          <h2
            style={{
              font: '600 var(--t-h3)/var(--lh-h3) var(--font-sans)',
              marginBottom: 'var(--s-2)',
            }}
          >
            Granularidad de tiempo
          </h2>
          <p
            style={{
              font: '400 var(--t-body)/var(--lh-body) var(--font-sans)',
              color: 'var(--ink-2)',
              marginBottom: 'var(--s-3)',
            }}
          >
            Define cómo el equipo introduce y visualiza esfuerzo y duración. El backend siempre almacena en horas;
            esto solo cambia cómo se presenta y cómo el Gantt ajusta el snap.
          </p>

          <div role="radiogroup" aria-label="Granularidad" className="flex flex-col gap-2">
            <label
              className="flex items-start gap-3 cursor-pointer"
              style={{
                padding: 'var(--s-3)',
                border: `1px solid var(${current === 'hours' ? '--p-500' : '--line'})`,
                borderRadius: 'var(--r-md)',
                background: current === 'hours' ? 'var(--p-50)' : 'transparent',
              }}
            >
              <input
                type="radio"
                name="time-granularity"
                value="hours"
                checked={current === 'hours'}
                onChange={() => onChange('hours')}
                disabled={isLoading || updateSettings.isPending}
              />
              <span>
                <strong>
                  <Clock className="w-4 h-4 inline mr-1" />
                  Horas
                </strong>
                <span
                  style={{
                    display: 'block',
                    font: '400 var(--t-small)/var(--lh-small) var(--font-sans)',
                    color: 'var(--ink-2)',
                  }}
                >
                  Estimación y duración en horas. El Gantt ajusta a inicio/fin de jornada según el calendario laboral.
                </span>
              </span>
            </label>

            <label
              className="flex items-start gap-3 cursor-pointer"
              style={{
                padding: 'var(--s-3)',
                border: `1px solid var(${current === 'days' ? '--p-500' : '--line'})`,
                borderRadius: 'var(--r-md)',
                background: current === 'days' ? 'var(--p-50)' : 'transparent',
              }}
            >
              <input
                type="radio"
                name="time-granularity"
                value="days"
                checked={current === 'days'}
                onChange={() => onChange('days')}
                disabled={isLoading || updateSettings.isPending}
              />
              <span>
                <strong>
                  <CalendarRange className="w-4 h-4 inline mr-1" />
                  Días
                </strong>
                <span
                  style={{
                    display: 'block',
                    font: '400 var(--t-small)/var(--lh-small) var(--font-sans)',
                    color: 'var(--ink-2)',
                  }}
                >
                  Estimación y duración en días laborales. El Gantt oculta horas y ajusta a día completo.
                </span>
              </span>
            </label>
          </div>

          {updateSettings.isError && (
            <p
              style={{
                color: 'var(--err-fg)',
                font: '400 var(--t-small)/var(--lh-small) var(--font-sans)',
                marginTop: 'var(--s-2)',
              }}
            >
              No se pudo guardar el cambio. Reintenta.
            </p>
          )}
        </section>

        <section>
          <h2
            style={{
              font: '600 var(--t-h3)/var(--lh-h3) var(--font-sans)',
              marginBottom: 'var(--s-2)',
            }}
          >
            Calendario laboral
          </h2>
          <p
            style={{
              font: '400 var(--t-body)/var(--lh-body) var(--font-sans)',
              color: 'var(--ink-2)',
              marginBottom: 'var(--s-3)',
            }}
          >
            Configura días laborales, horarios y feriados.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => projectId && navigate(`/project/${projectId}/settings/calendar`)}
          >
            Editar calendario
          </button>
        </section>
      </div>
    </div>
  );
};

export default ProjectSettingsPage;
