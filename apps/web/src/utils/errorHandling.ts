/**
 * Utilidades para manejo robusto de errores
 */

export interface AppError {
  message: string;
  code?: string;
  details?: unknown;
  timestamp: Date;
}

/**
 * Crea un error estandarizado de la aplicación
 */
export const createAppError = (
  message: string,
  code?: string,
  details?: unknown
): AppError => ({
  message,
  code,
  details,
  timestamp: new Date()
});

/**
 * Maneja errores de forma segura con logging
 */
export const handleError = (error: unknown, context: string): AppError => {
  const timestamp = new Date();

  if (error instanceof Error) {
    console.error(`[${context}] ${timestamp.toISOString()}:`, error.message, error.stack);
    return {
      message: error.message,
      code: error.name,
      details: { stack: error.stack },
      timestamp
    };
  }

  const errorMessage = String(error) || 'Error desconocido';
  console.error(`[${context}] ${timestamp.toISOString()}:`, errorMessage);

  return {
    message: errorMessage,
    code: 'UNKNOWN_ERROR',
    details: error,
    timestamp
  };
};

/**
 * Hook para manejo de errores en componentes
 */
export const useErrorHandler = () => {
  return (error: unknown, context: string = 'Component') => {
    return handleError(error, context);
  };
};

/**
 * Wrapper para funciones async con manejo de errores
 */
export const safeAsync = async <T>(
  fn: () => Promise<T>,
  context: string = 'AsyncOperation'
): Promise<{ data?: T; error?: AppError }> => {
  try {
    const data = await fn();
    return { data };
  } catch (error) {
    return { error: handleError(error, context) };
  }
};