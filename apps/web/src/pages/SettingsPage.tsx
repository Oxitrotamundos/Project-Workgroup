import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Key, Clock, User, ChevronRight, Users, Contact } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useUserRole } from '../hooks/useUserRole';
import { calendarService } from '../services/calendarService';
import type { WorkingCalendarResponse } from '@project-workgroup/shared';

interface SettingsCardProps {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  meta?: string;
}

const SettingsCard: React.FC<SettingsCardProps> = ({ to, icon, title, description, meta }) => (
  <Link
    to={to}
    className="group flex items-center gap-4 transition-all"
    style={{
      padding: 'var(--s-5)',
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--r-lg)',
      boxShadow: 'var(--sh-1)',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.boxShadow = 'var(--sh-2)';
      e.currentTarget.style.borderColor = 'var(--line-2)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.boxShadow = 'var(--sh-1)';
      e.currentTarget.style.borderColor = 'var(--line)';
    }}
  >
    <div
      className="flex-none flex items-center justify-center transition-colors"
      style={{
        width: 40,
        height: 40,
        borderRadius: 'var(--r-md)',
        background: 'var(--p-50)',
        color: 'var(--p-600)',
      }}
    >
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h3 style={{ font: '500 var(--t-h4)/var(--lh-h4) var(--font-sans)', color: 'var(--ink)', margin: 0 }}>
          {title}
        </h3>
        {meta && (
          <span style={{ font: '400 var(--t-caption)/1 var(--font-mono)', color: 'var(--ink-3)' }}>{meta}</span>
        )}
      </div>
      <p style={{ font: '400 var(--t-small)/var(--lh-small) var(--font-sans)', color: 'var(--ink-2)', margin: '4px 0 0' }}>
        {description}
      </p>
    </div>
    <ChevronRight className="w-4 h-4 transition-colors" style={{ color: 'var(--ink-3)' }} />
  </Link>
);

export default function SettingsPage() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [globalCal, setGlobalCal] = useState<WorkingCalendarResponse | null>(null);

  useEffect(() => {
    calendarService.getGlobal().then(setGlobalCal).catch(() => setGlobalCal(null));
  }, []);

  return (
    <section className="max-w-3xl mx-auto p-6 sm:p-8 space-y-8">
      <header>
        <p className="eyebrow" style={{ color: 'var(--p-600)', marginBottom: 'var(--s-2)' }}>
          Cuenta
        </p>
        <h1
          style={{
            font: '500 var(--t-h1)/var(--lh-h1) var(--font-sans)',
            letterSpacing: 'var(--tr-h1)',
            color: 'var(--ink)',
            margin: 0,
          }}
        >
          Configuración
        </h1>
        <p
          style={{
            font: '400 var(--t-small)/var(--lh-small) var(--font-sans)',
            color: 'var(--ink-2)',
            margin: 'var(--s-2) 0 0',
          }}
        >
          {user?.email ?? 'Tu cuenta'}
        </p>
      </header>

      <div className="space-y-3">
        <SettingsCard
          to="/account/profile"
          icon={<User className="w-5 h-5" />}
          title="Perfil"
          description="Nombre, correo y datos básicos"
        />

        <SettingsCard
          to="/account/api-keys"
          icon={<Key className="w-5 h-5" />}
          title="API keys"
          description="Tokens para integraciones externas y agentes"
        />

        <SettingsCard
          to="/settings/calendar"
          icon={<Clock className="w-5 h-5" />}
          title="Calendario laboral global"
          description="Jornada por defecto, festivos y zona horaria. Los proyectos sin override usan este calendario."
          meta={globalCal ? `${globalCal.hoursPerDay} h/día · ${globalCal.timezone}` : undefined}
        />
      </div>

      {isAdmin && (
        <div className="space-y-3">
          <p className="eyebrow" style={{ marginBottom: 'var(--s-2)' }}>Administración</p>

          <SettingsCard
            to="/admin/users"
            icon={<Users className="w-5 h-5" />}
            title="Usuarios"
            description="Roles y estado de acceso de los usuarios"
          />

          <SettingsCard
            to="/admin/resources"
            icon={<Contact className="w-5 h-5" />}
            title="Recursos"
            description="Personas y placeholders asignables a tareas y workload"
          />
        </div>
      )}
    </section>
  );
}
