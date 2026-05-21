import React, { useState, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useClickOutside } from '../../hooks/useClickOutside';
import { ChevronDown, LogOut, User, Settings, Moon, Sun } from 'lucide-react';
import type { UserProfileProps } from '../../types/navigation';
import { safeAsync } from '../../utils/errorHandling';

const UserProfile: React.FC<UserProfileProps> = memo(({ className = '' }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const closeDropdown = useCallback(() => {
    setIsDropdownOpen(false);
  }, []);

  const dropdownRef = useClickOutside<HTMLDivElement>(closeDropdown);

  const handleLogout = useCallback(async () => {
    closeDropdown();
    const { error } = await safeAsync(() => logout(), 'UserProfile.handleLogout');
    if (error) {
      alert(`Error al cerrar sesión: ${error.message}`);
    }
  }, [logout, closeDropdown]);

  const handleOpenProfile = useCallback(() => {
    closeDropdown();
    navigate('/settings');
  }, [closeDropdown, navigate]);

  const handleOpenSettings = useCallback(() => {
    closeDropdown();
    navigate('/settings');
  }, [closeDropdown, navigate]);

  const handleToggleTheme = useCallback(() => {
    toggleTheme();
  }, [toggleTheme]);

  const userInitial = user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U';
  const userName = user?.displayName || user?.email?.split('@')[0] || 'Usuario';
  const userEmail = user?.email || '';
  const isDark = theme === 'dark';

  const menuItemStyle: React.CSSProperties = {
    font: '400 var(--t-small)/1.2 var(--font-sans)',
    color: 'var(--ink-1)',
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="btn btn-ghost"
        style={{ paddingLeft: 6, paddingRight: 8, gap: 10 }}
      >
        <span
          className="avatar av-3"
          style={{ width: 26, height: 26, fontSize: 11, background: 'var(--p-500)', color: 'var(--ink-on-primary)' }}
        >
          {userInitial.toUpperCase()}
        </span>

        <span className="hidden md:flex flex-col items-start text-left min-w-0">
          <span
            className="truncate max-w-32"
            style={{ font: '500 12px/1.1 var(--font-sans)', color: 'var(--ink-1)' }}
          >
            {userName}
          </span>
          <span
            className="truncate max-w-32"
            style={{ font: '400 11px/1.1 var(--font-mono)', color: 'var(--ink-3)' }}
          >
            {userEmail}
          </span>
        </span>

        <ChevronDown
          className={`w-4 h-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
          style={{ color: 'var(--ink-3)' }}
        />
      </button>

      {isDropdownOpen && (
        <div
          className="absolute right-0 mt-2 w-64 z-50"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-lg)',
            boxShadow: 'var(--sh-3)',
            padding: 'var(--s-2) 0',
          }}
        >
          <div style={{ padding: 'var(--s-3) var(--s-4)', borderBottom: '1px solid var(--line)' }}>
            <div className="flex items-center gap-3">
              <span
                className="avatar md"
                style={{ background: 'var(--p-500)', color: 'var(--ink-on-primary)' }}
              >
                {userInitial.toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className="truncate"
                  style={{ font: '500 var(--t-small)/1.2 var(--font-sans)', color: 'var(--ink-1)', margin: 0 }}
                >
                  {userName}
                </p>
                <p
                  className="truncate"
                  style={{ font: '400 var(--t-caption)/1.2 var(--font-mono)', color: 'var(--ink-3)', margin: '2px 0 0' }}
                >
                  {userEmail}
                </p>
              </div>
            </div>
          </div>

          <div style={{ padding: 'var(--s-2) 0' }}>
            <MenuItem icon={<User className="w-4 h-4" />} onClick={handleOpenProfile} style={menuItemStyle}>
              Perfil
            </MenuItem>
            <MenuItem icon={<Settings className="w-4 h-4" />} onClick={handleOpenSettings} style={menuItemStyle}>
              Configuración
            </MenuItem>
            <MenuItem
              icon={isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              onClick={handleToggleTheme}
              style={menuItemStyle}
            >
              {isDark ? 'Modo claro' : 'Modo oscuro'}
            </MenuItem>

            <div style={{ height: 1, background: 'var(--line)', margin: 'var(--s-2) 0' }} />

            <MenuItem
              icon={<LogOut className="w-4 h-4" />}
              onClick={handleLogout}
              style={{ ...menuItemStyle, color: 'var(--err-fg)' }}
              danger
            >
              Cerrar Sesión
            </MenuItem>
          </div>
        </div>
      )}
    </div>
  );
});

interface MenuItemProps {
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
  style?: React.CSSProperties;
  danger?: boolean;
}

const MenuItem: React.FC<MenuItemProps> = ({ icon, onClick, children, style, danger }) => (
  <button
    onClick={onClick}
    className="flex items-center w-full gap-3 transition-colors duration-150"
    style={{
      padding: 'var(--s-2) var(--s-4)',
      background: 'transparent',
      border: 0,
      cursor: 'pointer',
      textAlign: 'left',
      ...style,
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = danger
        ? 'var(--err-bg)'
        : 'var(--surface-2)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'transparent';
    }}
  >
    <span style={{ color: danger ? 'var(--err-fg)' : 'var(--ink-3)' }}>{icon}</span>
    <span>{children}</span>
  </button>
);

UserProfile.displayName = 'UserProfile';

export default UserProfile;
