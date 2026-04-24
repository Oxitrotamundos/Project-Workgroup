import { useState, useEffect } from 'react';
import { UserService } from '../services/userService';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook personalizado para obtener el rol del usuario actual
 */
export function useUserRole() {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) {
        setUserRole(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const userData = await UserService.getUser(user.uid);
        setUserRole(userData?.role || 'member');
      } catch (err) {
        console.error('Error fetching user role:', err);
        setError('Error al obtener el rol del usuario');
        setUserRole('member'); // Rol por defecto
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, [user]);

  return {
    userRole,
    loading,
    error,
    isAdmin: userRole === 'admin',
    isPM: userRole === 'pm',
    isMember: userRole === 'member'
  };
}

export default useUserRole;