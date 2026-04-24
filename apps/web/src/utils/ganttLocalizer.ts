// Utilidad para forzar la localización del DOM del Gantt después del renderizado

// Mapas de traducciones directo
const textTranslations: Record<string, string> = {
  // Meses en inglés a español
  'January': 'Enero',
  'February': 'Febrero',
  'March': 'Marzo',
  'April': 'Abril',
  'May': 'Mayo',
  'June': 'Junio',
  'July': 'Julio',
  'August': 'Agosto',
  'September': 'Septiembre',
  'October': 'Octubre',
  'November': 'Noviembre',
  'December': 'Diciembre',

  // Versiones con año
  'January 2025': 'Enero 2025',
  'February 2025': 'Febrero 2025',
  'March 2025': 'Marzo 2025',
  'April 2025': 'Abril 2025',
  'May 2025': 'Mayo 2025',
  'June 2025': 'Junio 2025',
  'July 2025': 'Julio 2025',
  'August 2025': 'Agosto 2025',
  'September 2025': 'Septiembre 2025',
  'October 2025': 'Octubre 2025',
  'November 2025': 'Noviembre 2025',
  'December 2025': 'Diciembre 2025',

  // Campos del editor
  'Name': 'Nombre',
  'Description': 'Descripción',
  'Type': 'Tipo',
  'Start date': 'Fecha de inicio',
  'End date': 'Fecha de fin',
  'Duration': 'Duración',
  'Progress': 'Progreso',
  'Task name': 'Nombre de la tarea',

  // Botones
  'Save': 'Guardar',
  'Cancel': 'Cancelar',
  'Delete': 'Eliminar',
  'OK': 'Aceptar',
  'Add': 'Agregar',
  'Edit': 'Editar',

  // Tipos de tarea
  'Task': 'Tarea',
  'Milestone': 'Hito',
  'Summary task': 'Tarea resumen',

  // Días de la semana
  'Monday': 'Lunes',
  'Tuesday': 'Martes',
  'Wednesday': 'Miércoles',
  'Thursday': 'Jueves',
  'Friday': 'Viernes',
  'Saturday': 'Sábado',
  'Sunday': 'Domingo',

  // Días de la semana abreviados
  'Mon': 'Lun',
  'Tue': 'Mar',
  'Wed': 'Mié',
  'Thu': 'Jue',
  'Fri': 'Vie',
  'Sat': 'Sáb',
  'Sun': 'Dom',

  // Elementos de tiempo
  'Today': 'Hoy',
  'Tomorrow': 'Mañana',
  'Yesterday': 'Ayer',
  'This week': 'Esta semana',
  'Next week': 'Próxima semana',
  'This month': 'Este mes',
  'Next month': 'Próximo mes',

  // Toolbar
  'New task': 'Nueva tarea',
  'Move up': 'Mover arriba',
  'Move down': 'Mover abajo'
};

// Atributos que pueden necesitar traducción
const attributeTranslations: Record<string, string> = {
  'placeholder': 'placeholder',
  'title': 'title',
  'aria-label': 'aria-label'
};

// Función para traducir un elemento de texto
function translateTextNode(node: Text): void {
  const text = node.textContent?.trim();
  if (text && textTranslations[text]) {
    node.textContent = textTranslations[text];
  }
}

// Función para traducir atributos de un elemento
function translateElementAttributes(element: Element): void {
  for (const attr of Object.keys(attributeTranslations)) {
    const value = element.getAttribute(attr);
    if (value && textTranslations[value]) {
      element.setAttribute(attr, textTranslations[value]);
    }
  }
}

// Función para procesar un elemento y sus hijos recursivamente
function processElement(element: Element): void {
  // Traducir atributos del elemento
  translateElementAttributes(element);

  // Procesar todos los nodos hijos
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    null
  );

  const nodesToProcess: Node[] = [];
  let node;

  // Recopilar todos los nodos primero para evitar problemas de modificación durante la iteración
  while (node = walker.nextNode()) {
    nodesToProcess.push(node);
  }

  // Procesar los nodos
  nodesToProcess.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      translateTextNode(node as Text);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      translateElementAttributes(node as Element);
    }
  });
}

// Función principal para localizar el Gantt
export function localizeGanttDOM(container?: Element): void {
  const ganttContainer = container || document.querySelector('.wx-gantt');

  if (!ganttContainer) {
    console.warn('GanttLocalizer: No se encontró el contenedor del Gantt');
    return;
  }

  try {
    processElement(ganttContainer);
    console.log('GanttLocalizer: Localización DOM aplicada');
  } catch (error) {
    console.error('GanttLocalizer: Error aplicando localización DOM:', error);
  }
}

// Función para configurar la localización automática
export function setupAutoLocalization(container?: Element): () => void {
  let observer: MutationObserver | null = null;
  let timeoutId: NodeJS.Timeout | null = null;

  const applyLocalizationWithDelay = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      localizeGanttDOM(container);
    }, 100); // Pequeño delay para permitir que el DOM se estabilice
  };

  // Aplicar localización inicial
  applyLocalizationWithDelay();

  // Configurar observer para cambios en el DOM
  const ganttContainer = container || document.querySelector('.wx-gantt');

  if (ganttContainer) {
    observer = new MutationObserver(() => {
      applyLocalizationWithDelay();
    });

    observer.observe(ganttContainer, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'style'] // Solo observar cambios relevantes
    });

    console.log('GanttLocalizer: Auto-localización configurada');
  }

  // Función de cleanup
  return () => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    console.log('GanttLocalizer: Auto-localización desactivada');
  };
}

export default {
  localizeGanttDOM,
  setupAutoLocalization
};