// FCA-Agent - Background Service Worker
// Gère les communications avec le serveur Raspberry Pi

// Configuration
const API_BASE_URL = 'http://localhost:3000/api'; // À remplacer par l'adresse IP du Raspberry Pi
let authToken = null;

// Gestionnaire de messages depuis le popup ou les content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message reçu dans le background script:', message);
  
  if (message.action === 'getStatus') {
    // Vérification du statut de connexion
    checkServerConnection()
      .then(status => sendResponse({ status }))
      .catch(error => sendResponse({ status: 'disconnected', error: error.message }));
    return true; // Indique que la réponse sera envoyée de manière asynchrone
  }
  
  if (message.action === 'executeTask') {
    // Envoie une tâche au serveur
    executeTask(message.task, message.data)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// Vérifie la connexion au serveur
async function checkServerConnection() {
  try {
    const response = await fetch(`${API_BASE_URL}/status`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`Statut serveur: ${response.status}`);
    }
    
    const data = await response.json();
    return data.status || 'connected';
  } catch (error) {
    console.error('Erreur de connexion au serveur:', error);
    return 'disconnected';
  }
}

// Exécute une tâche via le serveur
async function executeTask(taskType, taskData) {
  try {
    const response = await fetch(`${API_BASE_URL}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authToken ? `Bearer ${authToken}` : ''
      },
      body: JSON.stringify({ type: taskType, data: taskData })
    });
    
    if (!response.ok) {
      throw new Error(`Erreur API: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Erreur lors de l\'exécution de la tâche:', error);
    throw error;
  }
}

// Initialisation: vérification du serveur au démarrage
chrome.runtime.onInstalled.addListener(() => {
  console.log('FCA-Agent installé/mis à jour');
  
  // Récupération du token stocké (si existant)
  chrome.storage.local.get(['authToken'], (result) => {
    if (result.authToken) {
      authToken = result.authToken;
      console.log('Token d\'authentification chargé');
    }
  });
  
  // Vérification initiale du serveur
  checkServerConnection()
    .then(status => {
      console.log('Statut du serveur:', status);
    })
    .catch(error => {
      console.error('Erreur lors de la vérification initiale du serveur:', error);
    });
});