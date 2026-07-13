import { useState, useEffect } from 'react';
import { UserService } from '../services/userService';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook personalizado para obtener el rol del usuario actual
 */
export function useUserRole() {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<string | null>(null);
  // Id numérico del backend (distinto del uid de Firebase); habilita comparar contra ownerId.
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) {
        setUserRole(null);
        setUserId(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const userData = await UserService.getUser(user.uid);
        setUserRole(userData?.role || 'member');
        setUserId(userData?.id ?? null);
      } catch (err) {
        console.error('Error fetching user role:', err);
        setError('Error al obtener el rol del usuario');
        setUserRole('member'); // Rol por defecto
        setUserId(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, [user]);

  return {
    userRole,
    userId,
    loading,
    error,
    isAdmin: userRole === 'admin',
    isPM: userRole === 'pm',
    isMember: userRole === 'member'
  };
}

export default useUserRole;