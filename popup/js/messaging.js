// FCA-Agent - Module de gestion des messages

// Référence à la zone de réponse
let responseArea;

/**
 * Initialise la zone de réponse
 * @param {HTMLElement} responseAreaElement - Élément DOM de la zone de réponse
 */
export function initMessaging(responseAreaElement) {
  responseArea = responseAreaElement;
  
  // Ajouter un style pour les conteneurs de messages
  const style = document.createElement('style');
  style.textContent = `
    /* Style pour les conteneurs de messages avec défilement */
    .message-text-container {
      max-height: 300px;
      overflow-y: auto;
      padding: 10px;
      border-radius: 5px;
      background-color: #f9f9f9;
      margin-top: 5px;
    }
    
    /* Animation pour le spinner de chargement */
    .loading-spinner {
      width: 20px;
      height: 20px;
      border: 3px solid #f3f3f3;
      border-top: 3px solid #3498db;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 10px auto;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

/**
 * Affiche un message dans la zone de réponse
 * @param {string} sender - Expéditeur du message ('user' ou 'assistant')
 * @param {string} text - Contenu du message
 * @returns {string} ID du message créé
 */
export function displayMessage(sender, text) {
  if (!responseArea) {
    console.error('Zone de réponse non initialisée');
    return null;
  }

  // Supprimer le message de bienvenue s'il existe
  const welcomeMessage = responseArea.querySelector('.welcome-message');
  if (welcomeMessage) {
    responseArea.removeChild(welcomeMessage);
  }
  
  const messageId = 'msg-' + Date.now();
  const messageElement = document.createElement('div');
  messageElement.id = messageId;
  messageElement.classList.add('message', `message-${sender}`, 'fade-in');
  
  // Détecter si le texte contient du HTML
  const containsHTML = /<[a-z][\s\S]*>/i.test(text);
  
  // Créer un conteneur pour le texte avec défilement pour tous les messages
  const textContainer = document.createElement('div');
  textContainer.className = 'message-text-container';
  
  // Gérer les retours à la ligne et le formattage
  if (containsHTML) {
    textContainer.innerHTML = text; // Si c'est du HTML (comme le spinner)
  } else {
    // Convertir les URL en liens cliquables
    const linkedText = text.replace(
      /(https?:\/\/[^\s]+)/g, 
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    textContainer.innerHTML = linkedText.replace(/\n/g, '<br>');
  }
  
  // Ajouter le conteneur au message
  messageElement.appendChild(textContainer);
  responseArea.appendChild(messageElement);
  
  // Scroll vers le bas
  responseArea.scrollTop = responseArea.scrollHeight;
  
  return messageId;
}

/**
 * Supprime un message par ID
 * @param {string} messageId - ID du message à supprimer
 */
export function removeMessage(messageId) {
  if (!responseArea) {
    console.error('Zone de réponse non initialisée');
    return;
  }

  const message = document.getElementById(messageId);
  if (message) {
    responseArea.removeChild(message);
  }
}

/**
 * Affiche un message de chargement avec spinner
 * @param {string} text - Texte à afficher
 * @returns {string} ID du message créé
 */
export function displayLoadingMessage(text = 'En cours de traitement...') {
  return displayMessage('assistant', `${text} <div class="loading-spinner"></div>`);
}

/**
 * Affiche un message d'erreur avec lien de secours si nécessaire
 * @param {string} errorMessage - Message d'erreur
 */
export function displayErrorMessage(errorMessage, responseId = null) {
  let message = `Erreur : ${errorMessage}`;  
  displayMessage('assistant', message);
}
