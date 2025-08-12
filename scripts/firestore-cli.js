#!/usr/bin/env node

/**
 * CLI interactivo para gestionar Firestore
 * Permite configurar, resetear y gestionar la base de datos (Att. AB)
 */

import { createInterface } from 'readline';
import { execSync } from 'child_process';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { setupFirestore } from './setup-firestore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuración
const CONFIG = {
  serviceAccountPath: join(__dirname, '../config/service-account-key.json'),
  envExamplePath: join(__dirname, '../.env.example'),
  envPath: join(__dirname, '../.env'),
  firebaseJsonPath: join(__dirname, '../firebase.json')
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

function logSuccess(message) {
  log(`${message}`, 'green');
}

function logError(message) {
  log(` ${message}`, 'red');
}

function logWarning(message) {
  log(` ${message}`, 'yellow');
}

function logInfo(message) {
  log(` ${message}`, 'blue');
}

// Crear interfaz readline
const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

// Función para hacer preguntas
function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

// Verificar prerequisitos
function checkPrerequisites() {
  const checks = [
    {
      name: 'Node.js version',
      check: () => {
        const version = process.version;
        const major = parseInt(version.slice(1).split('.')[0]);
        return major >= 16;
      },
      message: 'Node.js 16+ is required'
    },
    {
      name: 'Firebase CLI',
      check: () => {
        try {
          execSync('firebase --version', { stdio: 'ignore' });
          return true;
        } catch {
          return false;
        }
      },
      message: 'Firebase CLI es necesario para continuar. Instálalo con: npm install -g firebase-tools'
    }
  ];

  log('Verificando prerequisitos...', 'cyan');
  let allPassed = true;

  for (const check of checks) {
    if (check.check()) {
      logSuccess(`${check.name} ✓`);
    } else {
      logError(`${check.name} ✗ - ${check.message}`);
      allPassed = false;
    }
  }

  return allPassed;
}

// Configurar Firebase project
async function setupFirebaseProject() {
  log('\nConfigurando proyecto Firebase ...', 'bright');
  log('═'.repeat(50), 'cyan');

  const projectId = await question('Ingresa tu Project ID de Firebase: ');

  if (!projectId.trim()) {
    logError('Su Project ID es necesario');
    return false;
  }

  try {
    // Crear firebase.json si no existe
    if (!existsSync(CONFIG.firebaseJsonPath)) {
      const firebaseConfig = {
        firestore: {
          rules: 'firestore/firestore.rules',
          indexes: 'firestore/firestore.indexes.json'
        },
        hosting: {
          public: 'dist',
          ignore: ['firebase.json', '**/.*', '**/node_modules/**'],
          rewrites: [
            {
              source: '**',
              destination: '/index.html'
            }
          ]
        }
      };

      writeFileSync(CONFIG.firebaseJsonPath, JSON.stringify(firebaseConfig, null, 2));
      logSuccess('firebase.json creado con éxito');
    }

    // Configurar proyecto Firebase
    execSync(`firebase use ${projectId}`, { stdio: 'inherit' });
    logSuccess(`Proyecto Firebase configurado: ${projectId}`);

    return projectId;
  } catch (error) {
    logError(`Error al configurar proyecto Firebase: ${error.message}`);
    return false;
  }
}

// Configurar variables de entorno
async function setupEnvironmentVariables() {
  log('\n🌍 Configurando variables de entorno', 'bright');
  log('═'.repeat(50), 'cyan');

  logInfo('Necesitarás estos valores de Firebase Console > Project Settings > General');

  const envVars = {
    VITE_FIREBASE_API_KEY: 'Firebase API Key',
    VITE_FIREBASE_AUTH_DOMAIN: 'Auth Domain (project-id.firebaseapp.com)',
    VITE_FIREBASE_PROJECT_ID: 'Project ID',
    VITE_FIREBASE_STORAGE_BUCKET: 'Storage Bucket (project-id.appspot.com)',
    VITE_FIREBASE_MESSAGING_SENDER_ID: 'Messaging Sender ID',
    VITE_FIREBASE_APP_ID: 'App ID'
  };

  const envContent = [];

  for (const [key, description] of Object.entries(envVars)) {
    const value = await question(`${description}: `);
    if (value.trim()) {
      envContent.push(`${key}=${value.trim()}`);
    }
  }

  if (envContent.length > 0) {
    writeFileSync(CONFIG.envPath, envContent.join('\n') + '\n');
    logSuccess('Variables de entorno guardadas en .env');
    return true;
  } else {
    logWarning('No se configuraron variables de entorno');
    return false;
  }
}

// Configurar service account
async function setupServiceAccount() {
  log('\n Configurando service account', 'bright');
  log('═'.repeat(50), 'cyan');

  logInfo('Para generar una llave de cuenta de servicio:');
  log('1. Ve a Firebase Console > Project Settings > Service Accounts');
  log('2. Haz clic en "Generate new private key"');
  log('3. Guarda el archivo JSON como config/service-account-key.json');
  log('');

  const hasKey = await question('¿Tienes el archivo de llave de cuenta de servicio listo? (y/n): ');

  if (hasKey.toLowerCase() === 'y') {
    const keyPath = await question('Ingresa la ruta al archivo de llave de cuenta de servicio: ');

    if (!keyPath.trim()) {
      logError('La ruta al archivo de llave de cuenta de servicio es necesaria');
      return false;
    }

    if (existsSync(keyPath)) {
      try {
        const keyContent = readFileSync(keyPath, 'utf8');
        JSON.parse(keyContent); // Validar JSON

        // Aseguramos que el directorio config exista
        const configDir = dirname(CONFIG.serviceAccountPath);
        if (!existsSync(configDir)) {
          execSync(`mkdir -p ${configDir}`);
        }

        writeFileSync(CONFIG.serviceAccountPath, keyContent);
        logSuccess('Llave de cuenta de servicio configurada');
        return true;
      } catch (error) {
        logError(`Archivo de llave de cuenta de servicio inválido: ${error.message}`);
        return false;
      }
    } else {
      logError('Archivo de llave de cuenta de servicio no encontrado');
      return false;
    }
  } else {
    logWarning('Llave de cuenta de servicio es necesaria para el setup automático');
    return false;
  }
}

// Menú principal
async function showMainMenu() {
  log('\n Configuración de Firestore', 'bright');
  log('═'.repeat(50), 'cyan');
  log('1. Full Setup (Recomendado para nuevos proyectos)');
  log('2. Configurar proyecto Firebase');
  log('3. Configurar variables de entorno');
  log('4. Configurar service account');
  log('5. Ejecutar setup de Firestore');
  log('6. Desplegar reglas de seguridad');
  log('7. Desplegar índices');
  log('8. Verificar estado');
  log('9. Salir');
  log('');

  const choice = await question('Selecciona una opción (1-9): ');
  return choice.trim();
}

// Setup completo
async function fullSetup() {
  log('\ Iniciando setup completo...', 'bright');

  const steps = [
    { name: 'Prerequisites', fn: checkPrerequisites },
    { name: 'Firebase Project', fn: setupFirebaseProject },
    { name: 'Environment Variables', fn: setupEnvironmentVariables },
    { name: 'Service Account', fn: setupServiceAccount },
    { name: 'Firestore Setup', fn: () => setupFirestore() }
  ];

  for (const step of steps) {
    log(`\n📋 ${step.name}...`, 'yellow');
    const result = await step.fn();

    if (!result) {
      logError(`${step.name} falló. Setup abortado.`);
      return false;
    }
  }

  logSuccess('\n Setup completo completado con éxito!');
  log('\nSiguientes pasos:');
  log('1. Ejecutar: npm run dev');
  log('2. Probar autenticación en tu aplicación');
  log('3. Crear tu primer proyecto');

  return true;
}

// Verificar estado
function checkStatus() {
  log('\n Estado del proyecto', 'bright');
  log('═'.repeat(50), 'cyan');

  const checks = [
    { name: 'firebase.json', path: CONFIG.firebaseJsonPath },
    { name: '.env file', path: CONFIG.envPath },
    { name: 'Service Account Key', path: CONFIG.serviceAccountPath },
    { name: 'Firestore Rules', path: join(__dirname, '../firestore/firestore.rules') },
    { name: 'Firestore Indexes', path: join(__dirname, '../firestore/firestore.indexes.json') }
  ];

  for (const check of checks) {
    if (existsSync(check.path)) {
      logSuccess(`${check.name} ✓`);
    } else {
      logError(`${check.name} ✗`);
    }
  }

  // Verifica autenticación de Firebase CLI
  try {
    execSync('firebase projects:list', { stdio: 'ignore' });
    logSuccess('Firebase CLI autenticado ✓');
  } catch {
    logError('Firebase CLI no autenticado ✗');
    log('Ejecutar: firebase login');
    return false;
  }
}

// Función principal
async function main() {
  try {
    while (true) {
      const choice = await showMainMenu();

      switch (choice) {
        case '1':
          await fullSetup();
          break;
        case '2':
          await setupFirebaseProject();
          break;
        case '3':
          await setupEnvironmentVariables();
          break;
        case '4':
          await setupServiceAccount();
          break;
        case '5':
          await setupFirestore();
          break;
        case '6':
          try {
            execSync('firebase deploy --only firestore:rules', { stdio: 'inherit' });
            logSuccess('Reglas de seguridad desplegadas');
          } catch (error) {
            logError('Falló el despliegue de reglas de seguridad');
          }
          break;
        case '7':
          try {
            execSync('firebase deploy --only firestore:indexes', { stdio: 'inherit' });
            logSuccess('Índices desplegados');
          } catch (error) {
            logError('Falló el despliegue de índices');
          }
          break;
        case '8':
          checkStatus();
          break;
        case '9':
          log('\n Adiós!', 'cyan');
          rl.close();
          return;
        default:
          logError('Opción inválida. Por favor, intenta de nuevo.');
      }

      if (choice !== '9') {
        await question('\nPresiona Enter para continuar...');
      }
    }
  } catch (error) {
    logError(`Error en CLI: ${error.message}`);
  } finally {
    rl.close();
  }
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}