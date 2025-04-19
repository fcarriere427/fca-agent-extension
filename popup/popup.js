// FCA-Agent - Script du popup

document.addEventListener('DOMContentLoaded', () => {
  // Éléments DOM
  const userInput = document.getElementById('user-input');
  const submitBtn = document.getElementById('submit-btn');
  const responseArea = document.getElementById('response-area');
  const statusIndicator = document.getElementById('status-indicator');
  const quickTaskButtons = document.querySelectorAll('.task-btn');
  
  // Vérification du statut de connexion au serveur
  checkServerStatus();
  
  // Gestionnaire pour soumettre l'entrée utilisateur
  submitBtn.addEventListener('click', () => {
    processUserInput();
  });
  
  // Gestionnaire pour soumettre avec Entrée
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      processUserInput();
    }
  });
  
  // Gestionnaires pour les boutons d'actions rapides
  quickTaskButtons.forEach(button => {
    button.addEventListener('click', () => {
      const taskType = button.getAttribute('data-task');
      executeQuickTask(taskType);
    });
  });
  
  // Traitement de l'entrée utilisateur
  function processUserInput() {
    const input = userInput.value.trim();
    if (!input) return;
    
    // Afficher le message de l'utilisateur
    displayMessage('user', input);
    
    // Réinitialiser l'input
    userInput.value = '';
    
    // Afficher un message de chargement
    const loadingMsgId = displayMessage('assistant', 'En cours de traitement...');
    
    // Envoyer au background script pour traitement
    chrome.runtime.sendMessage(
      { 
        action: 'executeTask', 
        task: 'processUserInput', 
        data: { input } 
      },
      response => {
        // Supprimer le message de chargement
        removeMessage(loadingMsgId);
        
        if (response && response.success) {
          displayMessage('assistant', response.result.response);
        } else {
          displayMessage('assistant', 'Désolé, je n\'ai pas pu traiter votre demande. ' + 
                                       (response?.error || 'Veuillez réessayer.'));
        }
      }
    );
  }
  
  // Exécute une action rapide
  function executeQuickTask(taskType) {
    let taskPrompt = '';
    let taskTitle = '';
    
    switch(taskType) {
      case 'email-summary':
        taskPrompt = 'Résumer mes emails non lus';
        taskTitle = 'Résumé des emails';
        break;
      case 'teams-summary':
        taskPrompt = 'Résumer mes conversations Teams récentes';
        taskTitle = 'Résumé des conversations Teams';
        break;
      case 'draft-email':
        // Demander à l'utilisateur des détails supplémentaires
        taskPrompt = prompt('À propos de quoi souhaitez-vous rédiger un email ?');
        if (!taskPrompt) return; // L'utilisateur a annulé
        taskTitle = 'Brouillon d\'email';
        break;
      case 'settings':
        // Ouvrir les paramètres (à implémenter)
        displayMessage('assistant', 'La page des paramètres n\'est pas encore implémentée.');
        return;
      default:
        return;
    }
    
    // Afficher un message de chargement
    displayMessage('user', taskTitle + ': ' + taskPrompt);
    const loadingMsgId = displayMessage('assistant', 'En cours de traitement...');
    
    // Exécuter la tâche
    chrome.runtime.sendMessage(
      { 
        action: 'executeTask', 
        task: taskType, 
        data: { prompt: taskPrompt } 
      },
      response => {
        // Supprimer le message de chargement
        removeMessage(loadingMsgId);
        
        if (response && response.success) {
          displayMessage('assistant', response.result.response || 'Tâche exécutée avec succès.');
        } else {
          displayMessage('assistant', 'Désolé, je n\'ai pas pu exécuter cette tâche. ' + 
                                       (response?.error || 'Veuillez réessayer.'));
        }
      }
    );
  }
  
  // Vérifier le statut du serveur
  function checkServerStatus() {
    chrome.runtime.sendMessage({ action: 'getStatus' }, response => {
      if (response && response.status === 'connected') {
        statusIndicator.classList.remove('status-disconnected');
        statusIndicator.classList.add('status-connected');
        statusIndicator.title = 'Connecté au serveur';
      } else {
        statusIndicator.classList.remove('status-connected');
        statusIndicator.classList.add('status-disconnected');
        statusIndicator.title = 'Déconnecté du serveur' + 
                                (response?.error ? ': ' + response.error : '');
      }
    });
  }
  
  // Afficher un message dans la zone de réponse
  function displayMessage(sender, text) {
    // Supprimer le message de bienvenue s'il existe
    const welcomeMessage = responseArea.querySelector('.welcome-message');
    if (welcomeMessage) {
      responseArea.removeChild(welcomeMessage);
    }
    
    const messageId = 'msg-' + Date.now();
    const messageElement = document.createElement('div');
    messageElement.id = messageId;
    messageElement.classList.add('message', `message-${sender}`, 'fade-in');
    
    const textElement = document.createElement('p');
    textElement.textContent = text;
    
    messageElement.appendChild(textElement);
    responseArea.appendChild(messageElement);
    
    // Scroll vers le bas
    responseArea.scrollTop = responseArea.scrollHeight;
    
    return messageId;
  }
  
  // Supprimer un message par ID
  function removeMessage(messageId) {
    const message = document.getElementById(messageId);
    if (message) {
      responseArea.removeChild(message);
    }
  }
});