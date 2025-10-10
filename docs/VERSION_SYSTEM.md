# Sistema de Versión de la Aplicación

Este documento explica cómo funciona el sistema de versión en Gantt Workgroup y cómo utilizarlo correctamente.

## Arquitectura del Sistema

El sistema de versión utiliza una arquitectura de **build-time injection** mediante Vite, lo que garantiza que la versión siempre esté sincronizada con `package.json` sin necesidad de importar el archivo JSON directamente en el código de la aplicación.

### Flujo de Datos

```
package.json
    ↓
vite.config.ts (build time)
    ↓
Global Constants (__APP_VERSION__, __APP_NAME__)
    ↓
useAppVersion() hook
    ↓
Components (AppVersion, VersionBadge)
```

## Componentes del Sistema

### 1. Configuración de Vite

**Archivo:** `vite.config.ts`

```typescript
import packageJson from './package.json';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __APP_NAME__: JSON.stringify(packageJson.name),
  },
  // ... resto de configuración
});
```

**Funcionalidad:**
- Lee `package.json` en tiempo de compilación
- Inyecta las constantes globales en el bundle final
- Estas constantes son reemplazadas por sus valores literales (tree-shakeable)

### 2. Tipos TypeScript

**Archivo:** `src/vite-env.d.ts`

```typescript
declare const __APP_VERSION__: string;
declare const __APP_NAME__: string;
```

**Funcionalidad:**
- Proporciona tipos para las constantes globales
- Permite autocompletado y verificación de tipos en el IDE

### 3. Hook Personalizado

**Archivo:** `src/hooks/useAppVersion.ts`

```typescript
export interface AppVersionInfo {
  version: string;           // "0.1.0"
  name: string;              // "gantt-workgroup"
  major: number;             // 0
  minor: number;             // 1
  patch: number;             // 0
  versionWithPrefix: string; // "v0.1.0"
}

export function useAppVersion(): AppVersionInfo;
export function getAppVersion(): string;
export function getAppName(): string;
```

**Funcionalidad:**
- Encapsula el acceso a las constantes globales
- Parsea la versión semántica en sus componentes
- Proporciona funciones auxiliares para uso fuera de componentes React

### 4. Componentes de UI

#### AppVersion

**Archivo:** `src/components/Version/AppVersion.tsx`

Componente inline flexible para mostrar la versión.

```tsx
interface AppVersionProps {
  showPrefix?: boolean;    // Mostrar 'v' antes de la versión
  className?: string;      // Clases CSS personalizadas
  badge?: boolean;         // Mostrar como badge
  showAppName?: boolean;   // Incluir nombre de la app
}
```

**Ejemplos de uso:**

```tsx
import { AppVersion } from '@/components/Version';

// Simple
<AppVersion />
// Output: v0.1.0

// Sin prefijo
<AppVersion showPrefix={false} />
// Output: 0.1.0

// Como badge
<AppVersion badge />
// Output: [v0.1.0] (con estilos de badge)

// Con nombre de app
<AppVersion showAppName />
// Output: gantt-workgroup v0.1.0
```

#### VersionBadge

**Archivo:** `src/components/Version/VersionBadge.tsx`

Badge de posición fija para mostrar versión en esquinas.

```tsx
interface VersionBadgeProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  className?: string;
  showTooltip?: boolean;
}
```

**Ejemplos de uso:**

```tsx
import { VersionBadge } from '@/components/Version';

// Esquina inferior derecha (default)
<VersionBadge />

// Esquina superior izquierda
<VersionBadge position="top-left" />

// Sin tooltip
<VersionBadge showTooltip={false} />
```

## Casos de Uso

### 1. Mostrar versión en el footer

```tsx
import { AppVersion } from '@/components/Version';

function Footer() {
  return (
    <footer>
      <p>
        © 2025 Project Workgroup - <AppVersion />
      </p>
    </footer>
  );
}
```

### 2. Mostrar versión en About/Settings

```tsx
import { useAppVersion } from '@/hooks/useAppVersion';

function AboutPage() {
  const { version, major, minor, patch, name } = useAppVersion();

  return (
    <div>
      <h1>Acerca de {name}</h1>
      <p>Versión: {version}</p>
      <p>Mayor: {major}, Menor: {minor}, Parche: {patch}</p>
    </div>
  );
}
```

### 3. Logging y telemetría

```tsx
import { getAppVersion, getAppName } from '@/hooks/useAppVersion';

function logError(error: Error) {
  console.error({
    app: getAppName(),
    version: getAppVersion(),
    error: error.message,
    timestamp: new Date().toISOString(),
  });
}
```

### 4. API Headers

```tsx
import { getAppVersion } from '@/hooks/useAppVersion';

const api = axios.create({
  baseURL: 'https://api.example.com',
  headers: {
    'X-App-Version': getAppVersion(),
  },
});
```

## Buenas Prácticas

### Recomendado

1. **Usar el hook en componentes React**
   ```tsx
   const { version } = useAppVersion();
   ```

2. **Usar funciones auxiliares fuera de componentes**
   ```tsx
   const version = getAppVersion();
   ```

3. **Actualizar versión solo en package.json**
   - La versión se sincroniza automáticamente en el siguiente build

### No Recomendado

1. **Importar package.json directamente**
   ```tsx
   // MAL
   import packageJson from '../../../package.json';
   const version = packageJson.version;

   // BIEN
   const { version } = useAppVersion();
   ```

2. **Hardcodear la versión**
   ```tsx
   // MAL
   const VERSION = '0.1.0';

   // BIEN
   const { version } = useAppVersion();
   ```

## Actualización de Versión

Cuando incrementes la versión siguiendo [Semantic Versioning](https://semver.org/):

1. **Actualiza `package.json`**
   ```json
   {
     "version": "0.2.0"
   }
   ```

2. **Actualiza `CHANGELOG.md`**
   - Mueve cambios de `[Unreleased]` a nueva versión

3. **Rebuild la aplicación**
   ```bash
   npm run build
   ```

4. **Verifica en desarrollo**
   ```bash
   npm run dev
   ```

## Testing

### Unit Tests

```typescript
import { renderHook } from '@testing-library/react';
import { useAppVersion } from './useAppVersion';

describe('useAppVersion', () => {
  it('should return version info', () => {
    const { result } = renderHook(() => useAppVersion());

    expect(result.current.version).toBeDefined();
    expect(result.current.major).toBeGreaterThanOrEqual(0);
    expect(result.current.versionWithPrefix).toMatch(/^v\d+\.\d+\.\d+$/);
  });
});
```

### Component Tests

```typescript
import { render, screen } from '@testing-library/react';
import { AppVersion } from './AppVersion';

describe('AppVersion', () => {
  it('should display version with prefix', () => {
    render(<AppVersion />);
    expect(screen.getByText(/^v\d+\.\d+\.\d+$/)).toBeInTheDocument();
  });
});
```

## Troubleshooting

### La versión no se actualiza

**Problema:** Cambiaste `package.json` pero la app muestra versión antigua.

**Solución:**
1. Detén el servidor de desarrollo
2. Limpia caché: `rm -rf node_modules/.vite`
3. Reinicia: `npm run dev`

### TypeScript no reconoce las constantes globales

**Problema:** `__APP_VERSION__` muestra error de tipo.

**Solución:**
- Verifica que `src/vite-env.d.ts` esté incluido en `tsconfig.json`
- Reinicia el servidor de TypeScript en tu IDE

### Build falla por importación de JSON

**Problema:** Error al importar `package.json` en `vite.config.ts`.

**Solución:**
- Asegúrate de tener `"resolveJsonModule": true` en `tsconfig.node.json`

## Referencias

- [Semantic Versioning](https://semver.org/)
- [Vite - Define Feature](https://vitejs.dev/config/shared-options.html#define)
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Guía de versionado del proyecto

Atte. AB