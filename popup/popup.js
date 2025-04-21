// FCA-Agent - Script du popup (version ultra-simplifiée)

document.addEventListener('DOMContentLoaded', () => {
  // Éléments DOM
  const userInput = document.getElementById('user-input');
  const submitBtn = document.getElementById('submit-btn');
  const responseArea = document.getElementById('response-area');
  const statusIndicator = document.getElementById('status-indicator');
  const quickTaskButtons = document.querySelectorAll('.task-btn');
  
  // Vérifier si l'utilisateur est authentifié avant tout
  checkAuthOnce(() => {
    // Initialisation UI après vérification d'auth
    setupUI();
  });
  
  // Configuration de l'interface utilisateur
  function setupUI() {
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
    
    // Ajouter un bouton de déconnexion dans le header
    const header = document.querySelector('header');
    const logoutBtn = document.createElement('button');
    logoutBtn.id = 'logout-btn';
    logoutBtn.title = 'Déconnexion';
    logoutBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>';
    logoutBtn.addEventListener('click', handleLogout);
    header.appendChild(logoutBtn);
    
    // Style pour le bouton déconnexion
    const style = document.createElement('style');
    style.textContent = `
      #logout-btn {
        background: none;
        border: none;
        cursor: pointer;
        padding: 5px;
        margin-left: 10px;
        color: #777;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
      }
      #logout-btn:hover {
        background-color: #f0f0f0;
        color: #d9534f;
      }
    `;
    document.head.appendChild(style);
    
    // Gestionnaires pour les boutons d'actions rapides
    quickTaskButtons.forEach(button => {
      button.addEventListener('click', () => {
        const taskType = button.getAttribute('data-task');
        executeQuickTask(taskType);
      });
    });
    
    // Mise à jour du statut de connexion
    updateConnectionStatus();
  }
  
  // Vérification simple d'authentification
  function checkAuthOnce(callback) {
    chrome.runtime.sendMessage({ action: 'getUserData' }, (response) => {
      if (!response || !response.isAuthenticated) {
        console.log('Non authentifié, redirection vers login');
        window.location.href = 'login/login.html';
        return;
      }
      
      console.log('Authentification OK');
      if (callback) callback();
    });
  }
  
  // Mise à jour du statut de connexion au serveur
  function updateConnectionStatus() {
    chrome.storage.local.get(['apiBaseUrl'], (result) => {
      const serverUrl = result.apiBaseUrl || 'http://fca-agent.letsq.xyz/api';
      
      fetch(`${serverUrl}/status`, { 
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })
      .then(response => {
        if (response.ok) {
          statusIndicator.classList.remove('status-disconnected');
          statusIndicator.classList.add('status-connected');
          statusIndicator.title = 'Connecté au serveur';
        } else {
          throw new Error();
        }
      })
      .catch(() => {
        statusIndicator.classList.remove('status-connected');
        statusIndicator.classList.add('status-disconnected');
        statusIndicator.title = 'Déconnecté du serveur';
      });
    });
  }
  
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
        // Ouvrir la page des paramètres
        window.location.href = 'settings/settings.html';
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
  
  // Gère la déconnexion
  function handleLogout() {
    chrome.runtime.sendMessage({ action: 'logout' }, (response) => {
      if (response && response.success) {
        // Rediriger vers la page de connexion
        window.location.href = 'login/login.html';
      }
    });
  }
});