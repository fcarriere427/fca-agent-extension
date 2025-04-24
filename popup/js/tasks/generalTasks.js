// FCA-Agent - Module de tâches générales
import { displayMessage, displayLoadingMessage, removeMessage, displayErrorMessage } from '../messaging.js';
import { fetchFullResponse } from '../api.js';

/**
 * Traite l'entrée utilisateur et envoie au background script
 * @param {string} input - Entrée textuelle de l'utilisateur
 */
export function processUserInput(input) {
  if (!input) return;
  
  // Afficher le message de l'utilisateur
  displayMessage('user', input);
  
  // Afficher un message de chargement
  const loadingMsgId = displayLoadingMessage();
  
  // Envoyer au background script pour traitement
  chrome.runtime.sendMessage(
    { 
      action: 'executeTask', 
      task: 'processUserInput', 
      data: { input } 
    },
    response => handleTaskResponse(response, loadingMsgId)
  );
}

/**
 * Prépare un brouillon d'email selon les indications de l'utilisateur
 * @param {string} topic - Sujet de l'email à rédiger
 */
export function draftEmail(topic) {
  if (!topic) return;
  
  // Afficher le message utilisateur
  displayMessage('user', `Brouillon d'email: ${topic}`);
  
  // Afficher un message de chargement
  const loadingMsgId = displayLoadingMessage();
  
  // Envoyer au background script
  chrome.runtime.sendMessage(
    { 
      action: 'executeTask', 
      task: 'draft-email', 
      data: { prompt: topic } 
    },
    response => handleTaskResponse(response, loadingMsgId)
  );
}

/**
 * Gère la réponse d'une tâche exécutée
 * @param {Object} response - Réponse du background script
 * @param {string} loadingMsgId - ID du message de chargement à supprimer
 */
export function handleTaskResponse(response, loadingMsgId) {
  // Supprimer le message de chargement
  removeMessage(loadingMsgId);
  
  if (response && response.success) {
    // Vérifier si on a une référence à une réponse complète
    if (response.responseId && response.fullResponseAvailable) {
      // Afficher un message temporaire avec l'aperçu
      const tempMessageId = displayMessage('assistant', 
        `Chargement de la réponse complète...<br><br><em>Aperçu:</em> ${response.preview}`);
      
      // Récupérer la réponse complète depuis le serveur
      fetchFullResponse(response.responseId)
        .then(fullResponse => {
          // Supprimer le message temporaire
          removeMessage(tempMessageId);
          
          if (fullResponse) {
            // Afficher la réponse complète
            displayMessage('assistant', fullResponse);
          } else {
            displayMessage('assistant', 'Désolé, impossible de récupérer la réponse complète.');
          }
        })
        .catch(error => {
          // Supprimer le message temporaire
          removeMessage(tempMessageId);
          
          // Afficher une erreur avec lien vers la page de secours
          displayErrorMessage(error.message, response.responseId);
        });
    } else if (response.result && response.result.response) {
      displayMessage('assistant', response.result.response);
    } else {
      displayMessage('assistant', 'Réponse reçue mais format inattendu.');
    }
  } else {
    displayMessage('assistant', 'Désolé, je n\'ai pas pu traiter votre demande. ' + 
                               (response?.error || 'Veuillez réessayer.'));
  }
}
