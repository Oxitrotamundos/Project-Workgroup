/**
 * Script para migrar dependencias existentes del campo dependencies[] a la colección task_links
 * EJECUTAR SOLO SI HAY DATOS EXISTENTES QUE MIGRAR ATTE: AB
 */
const admin = require('firebase-admin');
const serviceAccount = require('../config/service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrateDependenciesToLinks() {
  try {
    console.log('Iniciando migración de dependencias...');

    // Obtener todas las tareas con dependencias
    const tasksSnapshot = await db.collection('tasks')
      .where('dependencies', '!=', [])
      .get();

    if (tasksSnapshot.empty) {
      console.log('No se encontraron tareas con dependencias para migrar.');
      return;
    }

    console.log(`Encontradas ${tasksSnapshot.size} tareas con dependencias.`);

    const batch = db.batch();
    let linkCount = 0;

    for (const taskDoc of tasksSnapshot.docs) {
      const task = taskDoc.data();
      const targetTaskId = taskDoc.id;

      if (task.dependencies && Array.isArray(task.dependencies)) {
        for (const sourceTaskId of task.dependencies) {
          // Crear enlace en nueva colección
          const linkRef = db.collection('task_links').doc();
          batch.set(linkRef, {
            projectId: task.projectId,
            sourceTaskId: sourceTaskId,
            targetTaskId: targetTaskId,
            type: 'e2s', // End-to-Start por defecto
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          linkCount++;
        }
      }
    }

    // Ejecutar migración
    await batch.commit();
    console.log(`Migración completada. ${linkCount} enlaces creados.`);

    // OPCIONAL: Limpiar campo dependencies (comentado por seguridad)
    // const cleanupBatch = db.batch();
    // for (const taskDoc of tasksSnapshot.docs) {
    //   cleanupBatch.update(taskDoc.ref, {
    //     dependencies: admin.firestore.FieldValue.delete()
    //   });
    // }
    // await cleanupBatch.commit();
    // console.log('Campo dependencies limpiado de las tareas.');

  } catch (error) {
    console.error('Error en migración:', error);
  }
}

// Ejecutar solo si se llama directamente
if (require.main === module) {
  migrateDependenciesToLinks()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Migración falló:', error);
      process.exit(1);
    });
}

module.exports = { migrateDependenciesToLinks };