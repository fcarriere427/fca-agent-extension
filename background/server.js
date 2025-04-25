// FCA-Agent - Module de communication avec le serveur

import { getApiUrl } from './config.js';
import { getAuthHeaders, setAuthenticated } from './auth.js';

// État de connexion au serveur
let isServerConnected = false;

// Méthodes d'accès à l'état de connexion
export function getServerStatus() {
  return { isConnected: isServerConnected };
}

// Mise à jour de l'état de connexion
export function setServerStatus(status) {
  const previousStatus = isServerConnected;
  isServerConnected = status;
  
  // Si changement de statut, notifier les composants
  if (previousStatus !== isServerConnected) {
    try {
      chrome.runtime.sendMessage({ 
        action: 'serverStatusChanged', 
        status: { isConnected: isServerConnected } 
      }, () => {
        // Ignorer toute erreur (comme "Receiving end does not exist")
        if (chrome.runtime.lastError) {
          console.log('Message serverStatusChanged non délivré (normal au démarrage)');
        }
      });
    } catch (error) {
      console.log('Erreur lors de l\'envoi du statut du serveur (normal au démarrage)');
    }
  }
}

// Vérifie si le serveur est en ligne
export async function checkServerOnline() {
  const apiUrl = getApiUrl();
  
  try {
    // Utiliser une requête simple pour vérifier si le serveur est en ligne
    const response = await fetch(`${apiUrl}/status`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      // Pas de credentials ici pour simplifier
      mode: 'no-cors' // Contournement CORS pour un simple test de connectivité
    });
    
    // Mode no-cors retourne toujours un statut opaque, donc on assume que le serveur est en ligne
    // si la requête ne génère pas d'exception
    setServerStatus(true);
    return true;
  } catch (error) {
    console.error('Erreur lors de la vérification du serveur:', error);
    setServerStatus(false);
    return false;
  }
}

// Exécute une tâche sur le serveur
export async function executeTaskOnServer(taskType, taskData) {
  const apiUrl = getApiUrl();
  const authHeaders = getAuthHeaders();
  
  try {
    const response = await fetch(`${apiUrl}/tasks`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...authHeaders
      },
      body: JSON.stringify({ type: taskType, data: taskData }),
      credentials: 'include'
    });
    
    // Si le serveur répond, c'est qu'il est connecté
    setServerStatus(true);
    
    if (response.status === 401) {
      // Authentification expirée
      setAuthenticated(false);
      throw new Error('Session expirée, veuillez vous reconnecter');
    }
    
    if (!response.ok) {
      throw new Error(`Erreur API: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Erreur lors de l\'exécution de la tâche:', error);
    
    // Si erreur de connexion, marquer le serveur comme déconnecté
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      setServerStatus(false);
    }
    
    throw error;
  }
}
