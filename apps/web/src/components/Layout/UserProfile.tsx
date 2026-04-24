import React, { useState, useCallback, memo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useClickOutside } from '../../hooks/useClickOutside';
import { ChevronDown, LogOut, User, Settings } from 'lucide-react';
import type { UserProfileProps } from '../../types/navigation';
import { safeAsync } from '../../utils/errorHandling';

/**
 * Componente de perfil de usuario con dropdown
 * Optimizado para performance con React.memo
 */
const UserProfile: React.FC<UserProfileProps> = memo(({ className = '' }) => {
  const { user, logout } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const closeDropdown = useCallback(() => {
    setIsDropdownOpen(false);
  }, []);

  const dropdownRef = useClickOutside<HTMLDivElement>(closeDropdown);

  const handleLogout = useCallback(async () => {
    closeDropdown();

    const { error } = await safeAsync(
      () => logout(),
      'UserProfile.handleLogout'
    );

    if (error) {
      // TODO: Integrar con sistema de notificaciones
      alert(`Error al cerrar sesión: ${error.message}`);
    }
  }, [logout, closeDropdown]);

  const handleMenuAction = useCallback((action: string) => {
    closeDropdown();
    // TODO: Implementar navegación basada en la acción
    console.log(`${action} clicked`);
  }, [closeDropdown]);

  const userInitial = user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U';
  const userName = user?.displayName || user?.email?.split('@')[0] || 'Usuario';
  const userEmail = user?.email || '';

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Boton usuario  */}
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center space-x-3 text-sm rounded-lg p-2 hover:bg-gray-50/80 transition-colors duration-200 group"
      >
        {/* Avatar */}
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-sm">
          <span className="text-white text-sm font-semibold">
            {userInitial.toUpperCase()}
          </span>
        </div>

        {/* User Info - Oculto en pantallas pequeñas */}
        <div className="hidden md:block text-left min-w-0">
          <p className="text-gray-900 font-medium truncate max-w-32">
            {userName}
          </p>
          <p className="text-gray-500 text-xs truncate max-w-32">
            {userEmail}
          </p>
        </div>

        {/* Dropdown */}
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
            isDropdownOpen ? 'rotate-180' : ''
          } group-hover:text-gray-600`}
        />
      </button>

      {/*  Menu dropdown */}
      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200/60 py-2 z-50 backdrop-blur-sm">
          {/* Sección información usuario */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold">
                  {userInitial.toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {userName}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {userEmail}
                </p>
              </div>
            </div>
          </div>

          {/* Sección items menu */}
          <div className="py-2">
            <button
              onClick={() => handleMenuAction('Profile settings')}
              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150"
              aria-label="Ver perfil de usuario"
            >
              <User className="w-4 h-4 mr-3 text-gray-400" />
              Perfil
            </button>

            <button
              onClick={() => handleMenuAction('Settings')}
              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150"
              aria-label="Abrir configuración"
            >
              <Settings className="w-4 h-4 mr-3 text-gray-400" />
              Configuración
            </button>

            <div className="border-t border-gray-100 my-2"></div>

            <button
              onClick={handleLogout}
              className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors duration-150"
              aria-label="Cerrar sesión"
            >
              <LogOut className="w-4 h-4 mr-3" />
              Cerrar Sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

UserProfile.displayName = 'UserProfile';

export default UserProfile;