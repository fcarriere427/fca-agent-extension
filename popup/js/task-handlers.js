// FCA-Agent - Gestionnaire des tâches pour le popup

import { executeGmailSummaryTask } from './tasks/gmailTasks.js';
import { taskHandlersLog as taskLog } from './logger-module.js';

/**
 * Configure les gestionnaires d'événements pour les boutons de tâches
 */
export function setupTaskHandlers() {
  taskLog('Initialisation des gestionnaires de tâches');
  
  document.addEventListener('click', (event) => {
    // Rechercher si l'élément cliqué est un bouton de tâche ou un de ses enfants
    const taskButton = event.target.closest('.task-btn');
    
    if (!taskButton) {
      return; // Ce n'est pas un bouton de tâche
    }
    
    const taskType = taskButton.getAttribute('data-task');
    taskLog(`Bouton de tâche cliqué: ${taskType}`);
    
    // Exécuter la tâche correspondante
    switch (taskType) {
      case 'gmail-summary':
        taskLog('Exécution de la tâche de résumé Gmail');
        executeGmailSummaryTask();
        break;
        
      // Ajouter d'autres types de tâches ici si nécessaire
        
      default:
        taskLog(`Type de tâche inconnu: ${taskType}`, 'error');
    }
  });
  
  taskLog('Gestionnaires de tâches configurés');
}
