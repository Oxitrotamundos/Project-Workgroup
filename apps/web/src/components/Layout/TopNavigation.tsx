import React, { memo, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Folder } from 'lucide-react';
import type { TopNavigationProps } from '../../types/navigation';
import { DEFAULT_TITLES, ROUTES } from '../../constants/navigation';
import UserProfile from './UserProfile';

const TopNavigation: React.FC<TopNavigationProps> = memo(({
  title = DEFAULT_TITLES.APP_NAME,
  subtitle,
  crumbs,
  showBackButton = false,
  backTo = ROUTES.DASHBOARD,
  actions,
  showLogo = false,
}) => {
  const hasCrumbs = Array.isArray(crumbs) && crumbs.length > 0;

  return (
    <nav className="topbar" role="navigation" aria-label="Navegación principal">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {showLogo && (
          <div className="flex items-center gap-3">
            <div className="logo-mark" />
            <div className="logo-text hidden sm:flex">
              <span className="logo-name">{DEFAULT_TITLES.APP_NAME}</span>
              <span className="logo-sub">Workgroup</span>
            </div>
          </div>
        )}

        {showBackButton && !hasCrumbs && (
          <Link
            to={backTo}
            className="btn btn-ghost btn-sm"
            aria-label="Volver"
            style={{ color: 'var(--ink-2)' }}
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Volver</span>
          </Link>
        )}

        {hasCrumbs ? (
          <div className="flex items-center gap-3 min-w-0">
            {showBackButton && (
              <Link
                to={backTo}
                className="btn btn-ghost btn-icon btn-sm"
                aria-label="Volver"
                style={{ color: 'var(--ink-3)' }}
              >
                <ChevronLeft className="w-4 h-4" />
              </Link>
            )}
            <nav className="crumbs min-w-0" aria-label="Migas de pan">
              <Folder
                className="w-3.5 h-3.5 shrink-0"
                aria-hidden="true"
                style={{ color: 'var(--ink-3)' }}
              />
              {crumbs!.map((crumb, idx) => {
                const isLast = idx === crumbs!.length - 1;
                return (
                  <Fragment key={`${crumb.label}-${idx}`}>
                    {isLast ? (
                      <span className="cur truncate" title={crumb.label}>
                        {crumb.label}
                      </span>
                    ) : crumb.to ? (
                      <Link
                        to={crumb.to}
                        className="truncate"
                        style={{ color: 'inherit' }}
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="truncate">{crumb.label}</span>
                    )}
                    {!isLast && <span className="sep">/</span>}
                  </Fragment>
                );
              })}
            </nav>
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <h1
              className="truncate"
              id="page-title"
              style={{
                font: '500 var(--t-h3)/var(--lh-h3) var(--font-sans)',
                letterSpacing: 'var(--tr-h3)',
                color: 'var(--ink)',
                margin: 0,
              }}
            >
              {title}
            </h1>
            {subtitle && (
              <p
                className="truncate"
                style={{
                  font: '400 var(--t-caption)/1.3 var(--font-sans)',
                  color: 'var(--ink-3)',
                  margin: '2px 0 0',
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
        )}
      </div>

      {actions && (
        <div className="actions shrink-0 mx-2 sm:mx-4">{actions}</div>
      )}

      <div className="shrink-0">
        <UserProfile />
      </div>
    </nav>
  );
});

TopNavigation.displayName = 'TopNavigation';

export default TopNavigation;
