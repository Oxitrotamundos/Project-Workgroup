#!/usr/bin/env node

/**
 * Script para configurar automáticamente Firestore con:
 * - Colecciones necesarias
 * - Reglas de seguridad
 * - Índices optimizados
 * - Datos de ejemplo (opcional)
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuración
const CONFIG = {
  serviceAccountPath: join(__dirname, '../config/service-account-key.json'),
  firestoreRulesPath: join(__dirname, '../firestore/firestore.rules'),
  firestoreIndexesPath: join(__dirname, '../firestore/firestore.indexes.json'),
  createSampleData: process.argv.includes('--sample-data'),
  verbose: process.argv.includes('--verbose')
};

// Colores para output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`[${step}] ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`${message}`, 'green');
}

function logError(message) {
  log(`${message}`, 'red');
}

function logWarning(message) {
  log(` ${message}`, 'yellow');
}

// Inicializar Firebase Admin
function initializeFirebase() {
  try {
    if (!existsSync(CONFIG.serviceAccountPath)) {
      throw new Error(`Clave de cuenta de servicio no encontrada en: ${CONFIG.serviceAccountPath}`);
    }

    const serviceAccount = JSON.parse(readFileSync(CONFIG.serviceAccountPath, 'utf8'));

    const app = initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id
    });

    const db = getFirestore(app);
    logSuccess('Firebase Admin inicializado con éxito');
    return { app, db, projectId: serviceAccount.project_id };
  } catch (error) {
    logError(`Error al inicializar Firebase: ${error.message}`);
    process.exit(1);
  }
}

// Crear colecciones con documentos de ejemplo
async function createCollections(db) {
  logStep('1', 'Creando colecciones en Firestore...');
  logWarning('Advertencia: Esto sobrescribirá cualquier colección existente con el mismo nombre.');

  const collections = [
    {
      name: 'users',
      sampleDoc: {
        email: 'admin@example.com',
        displayName: 'Admin User',
        role: 'admin',
        createdAt: new Date(),
        avatar: null
      }
    },
    {
      name: 'projects',
      sampleDoc: {
        name: 'Proyecto de Ejemplo',
        description: 'Este es un proyecto de ejemplo creado durante la configuración',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias desde hoy
        status: 'planning',
        ownerId: 'sample-user-id',
        members: ['sample-user-id'],
        color: '#3B82F6',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    },
    {
      name: 'tasks',
      sampleDoc: {
        projectId: 'sample-project-id',
        name: 'Tarea de Ejemplo',
        description: 'Esta es una tarea de ejemplo',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias desde hoy
        duration: 7,
        progress: 0,
        assigneeId: 'sample-user-id',
        dependencies: [],
        tags: ['setup', 'sample'],
        priority: 'medium',
        color: '#10B981',
        estimatedHours: 40,
        actualHours: 0,
        status: 'not-started',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    },
    {
      name: 'workload',
      sampleDoc: {
        userId: 'sample-user-id',
        taskId: 'sample-task-id',
        projectId: 'sample-project-id',
        date: new Date(),
        allocatedHours: 8,
        actualHours: 0
      }
    }
  ];

  for (const collection of collections) {
    try {
      const collectionRef = db.collection(collection.name);

      if (CONFIG.createSampleData) {
        await collectionRef.add(collection.sampleDoc);
        logSuccess(`Colección '${collection.name}' creada con datos de ejemplo`);
      } else {
        // Asegurate de que la colección exista creando un documento temporal y eliminándolo AB
        const tempDoc = await collectionRef.add({ temp: true });
        await tempDoc.delete();
        logSuccess(`Colección '${collection.name}' creada`);
      }
    } catch (error) {
      logError(`Error al crear la colección '${collection.name}': ${error.message}`);
    }
  }
}

// Configurar reglas de seguridad
async function setupSecurityRules(projectId) {
  logStep('2', 'Configurando reglas de seguridad en Firestore...');

  if (!existsSync(CONFIG.firestoreRulesPath)) {
    logWarning(`Archivo de reglas de Firestore no encontrado en: ${CONFIG.firestoreRulesPath}`);
    logWarning('Saltando la configuración de reglas de seguridad. Por favor, despliega las reglas manualmente.');
    return;
  }

  try {
    const rules = readFileSync(CONFIG.firestoreRulesPath, 'utf8');
    logSuccess('Reglas de Firestore cargadas con éxito');
    log('Para desplegar las reglas, ejecuta: firebase deploy --only firestore:rules', 'yellow');
  } catch (error) {
    logError(`Error al cargar las reglas de Firestore: ${error.message}`);
  }
}

// Configurar índices
async function setupIndexes(projectId) {
  logStep('3', 'Configurando índices en Firestore...');
  logWarning('Advertencia: Esto sobrescribirá cualquier índice existente con el mismo nombre.');

  if (!existsSync(CONFIG.firestoreIndexesPath)) {
    logWarning(`Archivo de índices de Firestore no encontrado en: ${CONFIG.firestoreIndexesPath}`);
    logWarning('Saltando la configuración de índices. Por favor, despliega los índices manualmente.');
    return;
  }

  try {
    const indexes = JSON.parse(readFileSync(CONFIG.firestoreIndexesPath, 'utf8'));
    logSuccess('Índices de Firestore cargados con éxito');
    log('Para desplegar los índices, ejecuta: firebase deploy --only firestore:indexes', 'yellow');
  } catch (error) {
    logError(`Error al cargar los índices de Firestore: ${error.message}`);
  }
}

// Función principal
async function main() {
  log('Iniciando la configuración de Firestore...', 'bright');
  log('', 'reiniciar');

  // Verificar argumentos
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    log('Uso: node setup-firestore.js [opciones]', 'bright');
    log('');
    log('Opciones:');
    log('  --sample-data    Crear datos de ejemplo en colecciones');
    log('  --verbose        Habilitar registro detallado');
    log('  --help, -h       Mostrar este mensaje de ayuda');
    log('');
    log('Requisitos previos:');
    log('  1. Coloca tu clave de cuenta de servicio en: config/service-account-key.json');
    log('  2. Asegúrate de que firestore.rules exista en: firestore/firestore.rules');
    log('  3. Asegúrate de que firestore.indexes.json exista en: firestore/firestore.indexes.json');
    log('');
    log('Pasos siguientes:');
    log('  1. Ejecuta el script para crear colecciones: node setup-firestore.js --sample-data');
    log('  2. Despliega las reglas de seguridad: firebase deploy --only firestore:rules');
    log('  3. Despliega los índices: firebase deploy --only firestore:indexes');
    return;
  }

  try {
    // Inicializar Firebase
    const { app, db, projectId } = initializeFirebase();

    // Ejecutar configuración
    await createCollections(db);
    await setupSecurityRules(projectId);
    await setupIndexes(projectId);

    log('', 'reset');
    logSuccess('Firestore se configuró exitosamente!');
    log('', 'reset');
    log('Pasos siguientes:', 'bright');
    log('1. Despliega las reglas de seguridad: firebase deploy --only firestore:rules');
    log('2. Despliega los índices: firebase deploy --only firestore:indexes');
    log('3. Actualiza tus variables de entorno con la configuración correcta de Firebase:');
    log('   - FIREBASE_API_KEY');
    log('   - FIREBASE_AUTH_DOMAIN');
    log('   - FIREBASE_PROJECT_ID');
    log('   - FIREBASE_STORAGE_BUCKET');
    log('   - FIREBASE_MESSAGING_SENDER_ID');
    log('   - FIREBASE_APP_ID');
    log('   - FIREBASE_MEASUREMENT_ID');
    log('');
    log('4. Reinicia la aplicación para aplicar los cambios.');

  } catch (error) {
    logError(`Setup failed: ${error.message}`);
    if (CONFIG.verbose) {
      console.error(error);
    }
    process.exit(1);
  }
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as setupFirestore };