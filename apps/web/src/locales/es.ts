// Localización en español para SVAR Gantt
// Basado en la estructura de wx-core-locales y wx-gantt-locales

export const es = {
  // Configuración del calendario
  calendar: {
    monthNames: [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ],
    monthNamesShort: [
      "Ene", "Feb", "Mar", "Abr", "May", "Jun",
      "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
    ],
    dayNames: [
      "Domingo", "Lunes", "Martes", "Miércoles",
      "Jueves", "Viernes", "Sábado"
    ],
    dayNamesShort: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
    dayNamesMin: ["D", "L", "M", "X", "J", "V", "S"],
    firstDay: 1, // Lunes como primer día de la semana
    weekHeader: "Sem",
    today: "Hoy",
    clear: "Limpiar",
    close: "Cerrar",
    timeOnlyTitle: "Solo hora",
    timeText: "Hora",
    hourText: "Hora",
    minuteText: "Minuto",
    secondText: "Segundo",
    currentText: "Ahora",
    ampm: false,
    month: "Mes",
    week: "Semana",
    day: "Día"
  },

  // Configuración del núcleo (core)
  core: {
    ok: "Aceptar",
    cancel: "Cancelar",
    save: "Guardar",
    close: "Cerrar",
    delete: "Eliminar",
    edit: "Editar",
    add: "Agregar",
    select: "Seleccionar",
    selectAll: "Seleccionar todo",
    clear: "Limpiar",
    apply: "Aplicar",
    reset: "Restablecer",
    search: "Buscar",
    loading: "Cargando...",
    noData: "No hay datos",
    confirm: "Confirmar",
    yes: "Sí",
    no: "No"
  },

  // Configuración específica del Gantt
  gantt: {
    // Encabezados de columnas
    columns: {
      text: "Nombre de la tarea",
      "start_date": "Fecha de inicio",
      "end_date": "Fecha de fin",
      duration: "Duración",
      progress: "Progreso",
      priority: "Prioridad",
      owner: "Responsable",
      status: "Estado"
    },

    // Etiquetas de acciones
    actions: {
      addTask: "Agregar tarea",
      addSubtask: "Agregar subtarea",
      editTask: "Editar tarea",
      deleteTask: "Eliminar tarea",
      copyTask: "Copiar tarea",
      cutTask: "Cortar tarea",
      pasteTask: "Pegar tarea"
    },

    // Tipos de tareas
    taskTypes: {
      task: "Tarea",
      project: "Proyecto",
      milestone: "Hito",
      summary: "Resumen"
    },

    // Estados y prioridades
    priorities: {
      low: "Baja",
      normal: "Normal",
      high: "Alta",
      urgent: "Urgente"
    },

    statuses: {
      notStarted: "No iniciado",
      inProgress: "En progreso",
      completed: "Completado",
      onHold: "En espera",
      cancelled: "Cancelado"
    },

    // Mensajes de confirmación
    messages: {
      confirmDelete: "¿Está seguro de que desea eliminar esta tarea?",
      confirmDeleteMultiple: "¿Está seguro de que desea eliminar las tareas seleccionadas?",
      taskCreated: "Tarea creada exitosamente",
      taskUpdated: "Tarea actualizada exitosamente",
      taskDeleted: "Tarea eliminada exitosamente",
      invalidDate: "Fecha inválida",
      invalidDuration: "Duración inválida"
    },

    // Formulario de edición
    form: {
      generalTab: "General",
      datesTab: "Fechas",
      notesTab: "Notas",
      taskName: "Nombre de la tarea",
      description: "Descripción",
      startDate: "Fecha de inicio",
      endDate: "Fecha de fin",
      duration: "Duración",
      progress: "Progreso (%)",
      priority: "Prioridad",
      status: "Estado",
      assignedTo: "Asignado a",
      notes: "Notas",
      dependencies: "Dependencias",
      resources: "Recursos"
    },

    // Toolbar
    toolbar: {
      addTask: "Nueva tarea",
      editTask: "Editar",
      deleteTask: "Eliminar",
      indent: "Sangrar",
      outdent: "Quitar sangría",
      moveUp: "Subir",
      moveDown: "Bajar",
      zoomIn: "Acercar",
      zoomOut: "Alejar",
      fitToScreen: "Ajustar a pantalla",
      fullScreen: "Pantalla completa",
      print: "Imprimir",
      export: "Exportar",
      import: "Importar",
      save: "Guardar",
      undo: "Deshacer",
      redo: "Rehacer"
    },

    // Escalas de tiempo
    scales: {
      day: "Día",
      week: "Semana",
      month: "Mes",
      quarter: "Trimestre",
      year: "Año"
    },

    // Contexto del menú
    contextMenu: {
      addTask: "Agregar tarea",
      addSubtask: "Agregar subtarea",
      editTask: "Editar tarea",
      deleteTask: "Eliminar tarea",
      copyTask: "Copiar tarea",
      cutTask: "Cortar tarea",
      pasteTask: "Pegar tarea",
      insertAbove: "Insertar arriba",
      insertBelow: "Insertar abajo"
    }
  },

  // Formatos de fecha
  formats: {
    dateFormat: "dd/mm/yyyy",
    timeFormat: "HH:mm",
    dateTimeFormat: "dd/mm/yyyy HH:mm",
    monthFormat: "MMMM yyyy",
    yearFormat: "yyyy",
    dayFormat: "dd",
    weekFormat: "'Semana' w"
  }
};

export default es;