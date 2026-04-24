import React, { useState, useEffect, useRef } from 'react';
import { useMembers } from '../hooks/useMembers';

interface MemberManagementProps {
  projectId: string;
  onClose?: () => void;
}

const MemberManagement: React.FC<MemberManagementProps> = ({ projectId, onClose }) => {
  const {
    members,
    searchResults,
    permissions,
    loading,
    searchLoading,
    error,
    searchUsers,
    addMember,
    removeMember,
    clearSearch
  } = useMembers(projectId);

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState<string | null>(null);
  const [isRemovingMember, setIsRemovingMember] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Buscar usuarios con debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        searchUsers({ query: searchQuery.trim(), limit: 3 });
        setShowSearchResults(true);
      }, 300);
    } else {
      clearSearch();
      setShowSearchResults(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, searchUsers, clearSearch]);

  // Manejar agregar miembro
  const handleAddMember = async (userId: string) => {
    setIsAddingMember(userId);
    try {
      await addMember(userId);
      setSearchQuery('');
      setShowSearchResults(false);
    } catch (error) {
      console.error('Error adding member:', error);
      alert(error instanceof Error ? error.message : 'Error al agregar miembro');
    } finally {
      setIsAddingMember(null);
    }
  };

  // Manejar quitar miembro
  const handleRemoveMember = async (userId: string, memberName: string) => {
    if (!confirm(`¿Estás seguro de que quieres quitar a ${memberName} del proyecto?`)) {
      return;
    }

    setIsRemovingMember(userId);
    try {
      await removeMember(userId);
    } catch (error) {
      console.error('Error removing member:', error);
      alert(error instanceof Error ? error.message : 'Error al quitar miembro');
    } finally {
      setIsRemovingMember(null);
    }
  };

  // Obtener color del rol
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'pm':
        return 'bg-blue-100 text-blue-800';
      case 'member':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Obtener texto del rol
  const getRoleText = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Admin';
      case 'pm':
        return 'PM';
      case 'member':
        return 'Miembro';
      default:
        return role;
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Cargando miembros...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Gestión de Miembros</h2>
          <p className="text-sm text-gray-600 mt-1">
            {members.length} miembro{members.length !== 1 ? 's' : ''} en el proyecto
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Barra de búsqueda */}
      {permissions?.canAddMembers && (
        <div className="mb-6 relative">
          <div className="relative">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar usuarios para agregar..."
              className="w-full px-4 py-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {searchLoading && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              </div>
            )}
          </div>

          {/* Resultados de búsqueda */}
          {showSearchResults && searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {user.displayName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{user.displayName}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleColor(user.role)}`}>
                      {getRoleText(user.role)}
                    </span>
                  </div>
                  <button
                    onClick={() => handleAddMember(user.id)}
                    disabled={isAddingMember === user.id}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isAddingMember === user.id ? (
                      <div className="flex items-center space-x-1">
                        <div className="animate-spin rounded-full h-3 w-3 border-b border-white"></div>
                        <span>Agregando...</span>
                      </div>
                    ) : (
                      'Agregar'
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* No hay resultados */}
          {showSearchResults && searchQuery.length >= 2 && searchResults.length === 0 && !searchLoading && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3">
              <p className="text-sm text-gray-500 text-center">No se encontraron usuarios</p>
            </div>
          )}
        </div>
      )}

      {/* Lista de miembros */}
      <div className="space-y-3">
        <h3 className="text-lg font-medium text-gray-900 mb-3">Miembros del Proyecto</h3>
        
        {members.length === 0 ? (
          <div className="text-center py-8">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="mt-2 text-sm text-gray-500">No hay miembros en este proyecto</p>
          </div>
        ) : (
          members.map((member) => (
            <div
              key={member.userId}
              className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-medium">
                    {member.displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">{member.displayName}</p>
                  <p className="text-sm text-gray-500">{member.email}</p>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleColor(member.role)}`}>
                  {getRoleText(member.role)}
                </span>
              </div>

              {/* Botón de quitar */}
              {permissions?.canRemoveMembers && (
                <button
                  onClick={() => handleRemoveMember(member.userId, member.displayName)}
                  disabled={isRemovingMember === member.userId}
                  className="px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRemovingMember === member.userId ? (
                    <div className="flex items-center space-x-1">
                      <div className="animate-spin rounded-full h-3 w-3 border-b border-red-600"></div>
                      <span>Quitando...</span>
                    </div>
                  ) : (
                    'Quitar'
                  )}
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Información de permisos */}
      {!permissions?.canAddMembers && !permissions?.canRemoveMembers && (
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-yellow-800">
              No tienes permisos para gestionar miembros en este proyecto.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberManagement;