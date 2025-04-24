// FCA-Agent - Module de tâches Outlook
import { displayMessage, displayLoadingMessage, removeMessage } from '../messaging.js';
import { handleTaskResponse } from './generalTasks.js';

/**
 * Exécute la tâche de synthèse des emails Outlook
 */
export function executeOutlookSummaryTask() {
  // Afficher le message utilisateur
  displayMessage('user', 'Résumé des emails Outlook');
  
  // Afficher un message de chargement
  const loadingMsgId = displayLoadingMessage();
  
  // Envoyer au background script pour traitement
  chrome.runtime.sendMessage(
    { 
      action: 'executeTask', 
      task: 'email-summary', 
      data: { prompt: 'Résumer mes emails Outlook non lus' } 
    },
    response => handleTaskResponse(response, loadingMsgId)
  );
}
