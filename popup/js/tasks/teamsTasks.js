// FCA-Agent - Module de tâches Teams
import { displayMessage, displayLoadingMessage, removeMessage } from '../messaging.js';
import { handleTaskResponse } from './generalTasks.js';

/**
 * Exécute la tâche de synthèse des conversations Teams
 */
export function executeTeamsSummaryTask() {
  // Afficher le message utilisateur
  displayMessage('user', 'Résumé des conversations Teams');
  
  // Afficher un message de chargement
  const loadingMsgId = displayLoadingMessage();
  
  // Envoyer au background script pour traitement
  chrome.runtime.sendMessage(
    { 
      action: 'executeTask', 
      task: 'teams-summary', 
      data: { prompt: 'Résumer mes conversations Teams récentes' } 
    },
    response => handleTaskResponse(response, loadingMsgId)
  );
}
