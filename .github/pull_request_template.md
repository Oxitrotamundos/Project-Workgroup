## Tipo de Cambio

<!-- Marca con una X el tipo de cambio que corresponde -->

- [ ] **Patch** (v+0.0.1) - Fix/mejora menor
- [ ] **Minor** (v+0.1.0) - Feature mediana
- [ ] **Major** (v+1.0.0) - Epic/Breaking change

## Nueva Versión

**v0.X.X** → **v0.X.X**

## Descripción

<!-- Describe los cambios realizados de manera clara y concisa -->

### ¿Qué problema resuelve este PR?
<!-- Describe el problema o la necesidad que aborda este PR -->

### ¿Cómo lo resuelve?
<!-- Explica la solución implementada -->

## Cambios Principales

<!-- Lista los cambios más importantes -->

-
-
-

## Archivos Modificados

### Componentes
<!-- Lista los componentes que fueron modificados/creados -->

-

### Servicios
<!-- Lista los servicios que fueron modificados/creados -->

-

### Tipos
<!-- Lista los tipos que fueron modificados/creados -->

-

### Otros
<!-- Otros archivos relevantes -->

-

## Checklist Obligatorio

<!-- Marca con X todos los items antes de solicitar revisión -->

- [ ] Código probado localmente
- [ ] Versión actualizada en `package.json`
- [ ] `CHANGELOG.md` actualizado en la sección `[Unreleased]`
- [ ] Sin errores de lint (`npm run lint`)
- [ ] Build exitoso sin errores (`npm run build`)
- [ ] Tests ejecutados y pasando (`npm run test:run`)

## Checklist Adicional

<!-- Marca con X si aplica -->

- [ ] Tests unitarios agregados/actualizados
- [ ] Documentación actualizada en `README.md` (si hay cambios arquitectónicos)
- [ ] Reglas de Firestore actualizadas (si aplica)
- [ ] Indexes de Firestore actualizados (si aplica)
- [ ] Tipos de TypeScript actualizados
- [ ] Localization actualizada (es.ts / gantt-es.ts)
- [ ] Componentes tienen manejo de errores apropiado
- [ ] Se verificó compatibilidad con datos existentes

## Testing

### Pasos para probar

1.
2.
3.

### Casos de prueba cubiertos

- [ ] Flujo normal (happy path)
- [ ] Manejo de errores
- [ ] Casos extremos (edge cases)
- [ ] Validaciones

## Screenshots / Videos

<!-- Si hay cambios visuales, agrega screenshots o videos -->

### Antes
<!-- Screenshot del estado anterior (si aplica) -->

### Después
<!-- Screenshot del estado nuevo -->

## Impacto

### Breaking Changes

<!-- ¿Este PR introduce cambios que rompen compatibilidad? -->

- [ ] No introduce breaking changes
- [ ] Sí, introduce breaking changes (describe abajo)

<!-- Si hay breaking changes, describe qué necesita hacer el usuario para migrar -->

### Rendimiento

<!-- ¿Este PR afecta el rendimiento? -->

- [ ] Sin impacto en rendimiento
- [ ] Mejora el rendimiento
- [ ] Puede afectar el rendimiento (describe abajo)

### Seguridad

<!-- ¿Este PR tiene implicaciones de seguridad? -->

- [ ] Sin implicaciones de seguridad
- [ ] Mejora la seguridad
- [ ] Requiere revisión de seguridad (describe abajo)

## Dependencias

<!-- ¿Este PR depende de otros PRs o issues? -->

### Depende de
<!-- Lista PRs/Issues que deben mergearse primero -->

-

### Bloquea a
<!-- Lista PRs/Issues que están esperando por este -->

-

### Issues Relacionados

<!-- Lista issues relacionados usando #número -->

Closes #
Related to #

## Notas para Revisores

<!-- Información adicional que ayude a los revisores -->

### Áreas que requieren atención especial

-

### Decisiones de diseño importantes

-

### Preguntas abiertas

-

## Post-Merge Checklist

<!-- Acciones a realizar después del merge -->

- [ ] Actualizar documentación externa (si aplica)
- [ ] Notificar al equipo de cambios importantes
- [ ] Deploy de reglas de Firestore (si aplica)
- [ ] Deploy de indexes de Firestore (si aplica)
- [ ] Monitorear errores después del deploy

---

