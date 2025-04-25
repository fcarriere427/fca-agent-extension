// FCA-Agent - Script de la page de connexion (version simplifiée et robuste)

// Logger spécifique à la page de login
function loginLog(message, level = 'info') {
  const prefix = '[UI:LOGIN]';
  switch(level) {
    case 'error':
      console.error(`${prefix} ${message}`);
      break;
    case 'warn':
      console.warn(`${prefix} ${message}`);
      break;
    default:
      console.log(`${prefix} ${message}`);
  }
}

// Vérification immédiate si l'utilisateur est déjà authentifié
loginLog('Vérification du statut d\'authentification au chargement');

chrome.runtime.sendMessage({ action: 'checkAuthentication' }, (response) => {
  // Gérer les erreurs de communication
  if (chrome.runtime.lastError) {
    loginLog(`Erreur de communication: ${chrome.runtime.lastError.message}`, 'error');
    return; // Rester sur la page de login en cas d'erreur
  }
  
  loginLog(`Réponse de vérification: ${JSON.stringify(response)}`);
  
  if (response && response.authenticated) {
    loginLog('Déjà authentifié, redirection vers la page principale');
    window.location.href = '../popup.html';
    return;
  }
  
  loginLog('Non authentifié, affichage de la page de login');
});

document.addEventListener('DOMContentLoaded', () => {
  loginLog('Initialisation de la page de login');
  
  // Éléments DOM
  const loginForm = document.getElementById('login-form');
  const loginButton = document.querySelector('.btn-primary');
  const passwordInput = document.getElementById('login-password');
  const statusIndicator = document.getElementById('status-indicator');
  const serverConfigBtn = document.getElementById('server-config-btn');
  const serverConfigPanel = document.getElementById('server-config-panel');
  const serverUrlInput = document.getElementById('server-url');
  const saveServerConfig = document.getElementById('save-server-config');
  const loginError = document.getElementById('login-error');
  
  // Récupérer l'URL du serveur au démarrage
  loginLog('Récupération de l\'URL du serveur depuis le stockage local');
  
  chrome.storage.local.get(['apiBaseUrl'], (result) => {
    if (chrome.runtime.lastError) {
      loginLog(`Erreur lors de la récupération de l'URL: ${chrome.runtime.lastError.message}`, 'error');
    }
    
    let serverUrl = '';
    if (result.apiBaseUrl) {
      serverUrl = result.apiBaseUrl;
      loginLog(`URL du serveur trouvée: ${serverUrl}`);
    } else {
      // Valeur par défaut
      serverUrl = 'http://fca-agent.letsq.xyz/api';
      loginLog(`Aucune URL trouvée, utilisation de la valeur par défaut: ${serverUrl}`, 'warn');
      
      // Sauvegarder la valeur par défaut
      chrome.storage.local.set({ 'apiBaseUrl': serverUrl }, () => {
        loginLog('URL par défaut enregistrée dans le stockage local');
      });
    }
    
    // Mettre à jour l'interface
    serverUrlInput.value = serverUrl;
    
    // Mettre à jour l'URL dans le background script
    chrome.runtime.sendMessage({ action: 'updateApiUrl', url: serverUrl }, () => {
      if (chrome.runtime.lastError) {
        loginLog(`Erreur lors de la mise à jour de l'URL: ${chrome.runtime.lastError.message}`, 'error');
      }
      
      // Vérifier l'état de connexion au serveur
      updateServerStatus();
    });
  });
  
  // Gestionnaire pour le formulaire de connexion
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const password = passwordInput.value;
    if (!password) {
      showError('Veuillez saisir un mot de passe');
      return;
    }
    
    loginLog(`Tentative de connexion avec mot de passe: ${password === 'debug' ? 'debug' : '********'}`);
    
    // Désactiver le bouton pendant la connexion
    loginButton.disabled = true;
    loginButton.textContent = 'Connexion en cours...';
    
    // Utilisation du background script pour la connexion
    chrome.runtime.sendMessage(
      { action: 'login', password: password },
      handleLoginResponse
    );
  });
  
  // Configuration du serveur
  serverConfigBtn.addEventListener('click', () => {
    const isVisible = serverConfigPanel.style.display === 'block';
    serverConfigPanel.style.display = isVisible ? 'none' : 'block';
    loginLog(`Panneau de configuration ${isVisible ? 'masqué' : 'affiché'}`);
  });
  
  saveServerConfig.addEventListener('click', () => {
    const newUrl = serverUrlInput.value.trim();
    if (!newUrl) {
      loginLog('URL vide, aucune action');
      return;
    }
    
    loginLog(`Sauvegarde de la nouvelle URL du serveur: ${newUrl}`);
    
    // Sauvegarder dans le stockage local et mettre à jour l'URL dans le background script
    chrome.storage.local.set({ 'apiBaseUrl': newUrl }, () => {
      if (chrome.runtime.lastError) {
        loginLog(`Erreur lors de l'enregistrement de l'URL: ${chrome.runtime.lastError.message}`, 'error');
        return;
      }
      
      chrome.runtime.sendMessage({ action: 'updateApiUrl', url: newUrl }, () => {
        if (chrome.runtime.lastError) {
          loginLog(`Erreur lors de la mise à jour de l'URL: ${chrome.runtime.lastError.message}`, 'error');
          return;
        }
        
        loginLog('URL mise à jour avec succès');
        updateServerStatus();
        serverConfigPanel.style.display = 'none';
      });
    });
  });
  
  // Gestion de la réponse de connexion
  function handleLoginResponse(response) {
    // Réactiver le bouton
    loginButton.disabled = false;
    loginButton.textContent = 'Se connecter';
    
    // Vérifier d'abord s'il y a eu une erreur de communication
    if (chrome.runtime.lastError) {
      loginLog(`Erreur de communication: ${chrome.runtime.lastError.message}`, 'error');
      showError('Erreur de communication avec le background script');
      return;
    }
    
    loginLog(`Réponse de login reçue: ${JSON.stringify(response)}`);
    
    // Gérer la réponse
    if (response && response.success) {
      loginLog('Connexion réussie');
      handleLoginSuccess();
    } else {
      const errorMsg = response && response.error ? response.error : 'Erreur de connexion';
      loginLog(`Échec de connexion: ${errorMsg}`, 'error');
      showError(errorMsg);
    }
  }
  
  // Gère le succès de connexion
  function handleLoginSuccess() {
    // Afficher un message de succès avant la redirection
    loginForm.innerHTML = `
      <div style="text-align: center; color: #28a745; margin: 20px 0;">
        <p>Connexion réussie !</p>
        <button id="continue-btn" class="btn btn-primary">Continuer</button>
      </div>
    `;
    
    document.getElementById('continue-btn').addEventListener('click', () => {
      loginLog('Redirection vers la page principale');
      window.location.href = '../popup.html';
    });
  }
  
  // Fonctions utilitaires
  function showError(message) {
    loginLog(`Affichage de l'erreur: ${message}`, 'error');
    loginError.textContent = message;
    loginError.style.display = 'block';
  }
  
  // Vérification du statut du serveur
  function updateServerStatus() {
    loginLog('Vérification du statut du serveur');
    
    chrome.runtime.sendMessage({ action: 'checkServerOnline' }, (response) => {
      // Gérer les erreurs de communication
      if (chrome.runtime.lastError) {
        loginLog(`Erreur lors de la vérification: ${chrome.runtime.lastError.message}`, 'error');
        updateStatusIndicator(false);
        return;
      }
      
      loginLog(`Réponse de statut: ${JSON.stringify(response)}`);
      
      if (response && response.isConnected) {
        loginLog('Serveur connecté');
        updateStatusIndicator(true);
      } else {
        loginLog('Serveur déconnecté');
        updateStatusIndicator(false);
      }
    });
  }
  
  // Met à jour l'indicateur visuel de statut
  function updateStatusIndicator(isConnected) {
    if (!statusIndicator) {
      loginLog('Indicateur de statut non trouvé', 'error');
      return;
    }
    
    loginLog(`Mise à jour de l'indicateur: ${isConnected ? 'connecté' : 'déconnecté'}`);
    
    statusIndicator.className = 'status-indicator';
    statusIndicator.classList.add(isConnected ? 'status-connected' : 'status-disconnected');
    statusIndicator.title = isConnected ? 'Connecté au serveur' : 'Déconnecté du serveur';
  }
});
