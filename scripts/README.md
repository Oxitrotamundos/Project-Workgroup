# Scripts de Automatización Firestore

Este directorio contiene scripts para automatizar la configuración de Firestore para el proyecto Gantt Workgroup.

##  Uso Rápido

### CLI Interactivo (Recomendado)
```bash
npm run setup:cli
```

### Scripts Directos
```bash
# Configuración básica
npm run setup:firestore

# Con datos de ejemplo
npm run setup:firestore:sample
```

## Archivos

### `setup-firestore.js`
Script principal que:
-  Crea colecciones de Firestore
-  Configura estructura de datos
-  Opcionalmente crea datos de ejemplo
-  Valida configuración

**Uso:**
```bash
node scripts/setup-firestore.js [opciones]

# Opciones:
--sample-data    # Crear datos de ejemplo
--verbose        # Logging detallado
--help          # Mostrar ayuda
```

### `firestore-cli.js`
CLI interactivo que:
-  Guía paso a paso por la configuración
-  Verifica prerequisitos
-  Configura variables de entorno
-  Configura service account
-  Muestra estado del proyecto
-  Despliega reglas e índices

**Uso:**
```bash
node scripts/firestore-cli.js
```

##  Prerequisitos

1. **Node.js 16+**
2. **Firebase CLI**: `npm install -g firebase-tools`
3. **Proyecto Firebase** creado
4. **Autenticación**: `firebase login`

##  Lo que hacen los scripts

### Colecciones creadas:
- `users` - Información de usuarios
- `projects` - Proyectos del workspace
- `tasks` - Tareas de los proyectos
- `workload` - Carga de trabajo por usuario

### Archivos generados:
- `firestore/firestore.rules` - Reglas de seguridad
- `firestore/firestore.indexes.json` - Índices optimizados
- `firebase.json` - Configuración de Firebase
- `.env` - Variables de entorno (si se configura)

### Datos de ejemplo (con --sample-data):
- 1 Usuario administrador
- 1 Proyecto de muestra
- 1 Tarea de ejemplo
- 1 Entrada de carga de trabajo

## Seguridad

### Archivos sensibles (NO commitear):
- `config/service-account-key.json`
- `.env`
- `.firebase/`

### Reglas implementadas:
-  Autenticación requerida
-  Permisos por rol (admin/pm/member)
-  Acceso por membresía de proyecto
-  Validación de propietarios

##  Troubleshooting

### Error común: "Service account key not found"
**Solución:**
1. Ve a Firebase Console > Configuración > Cuentas de servicio
2. Genera nueva clave privada
3. Guarda como `config/service-account-key.json`

### Error: "Firebase CLI not authenticated"
**Solución:**
```bash
firebase login
```

### Error: "Project not found"
**Solución:**
```bash
firebase use tu_proyecto_id
```

## Ayuda

Para ayuda detallada:
```bash
node scripts/setup-firestore.js --help
```

O usa el CLI interactivo:
```bash
npm run setup:cli
```

---

**Tip:** Usa siempre el CLI interactivo para la primera configuración. Es más fácil y te guía paso a paso. Atte. AB