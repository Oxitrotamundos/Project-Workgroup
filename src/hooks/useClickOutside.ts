import { useEffect, useRef } from 'react';

/**
 * Hook personalizado para detectar clics fuera de un elemento
 * @param callback Función a ejecutar cuando se detecta un clic fuera
 * @returns Ref para asociar al elemento
 */
export const useClickOutside = <T extends HTMLElement = HTMLElement>(
  callback: () => void
) => {
  const ref = useRef<T>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback();
      }
    };

    // Agregar listener solo cuando el componente está montado
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [callback]);

  return ref;
};