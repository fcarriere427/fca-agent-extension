// FCA-Agent - Script de la page de connexion (version ultra-simplifiée)

document.addEventListener('DOMContentLoaded', () => {
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
  let serverUrl = '';
  chrome.storage.local.get(['apiBaseUrl'], (result) => {
    if (result.apiBaseUrl) {
      serverUrl = result.apiBaseUrl;
      serverUrlInput.value = serverUrl;
    } else {
      // Valeur par défaut
      serverUrl = 'http://fca-agent.letsq.xyz/api';
      serverUrlInput.value = serverUrl;
      chrome.storage.local.set({ 'apiBaseUrl': serverUrl });
    }
    
    // Définir le statut de connexion
    updateStatus();
  });
  
  // Gestionnaire pour le formulaire de connexion
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const password = passwordInput.value;
    if (!password) {
      showError('Veuillez saisir un mot de passe');
      return;
    }
    
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
    serverConfigPanel.style.display = serverConfigPanel.style.display === 'none' ? 'block' : 'none';
  });
  
  saveServerConfig.addEventListener('click', () => {
    const newUrl = serverUrlInput.value.trim();
    if (newUrl) {
      serverUrl = newUrl;
      // Sauvegarder dans le stockage local et mettre à jour l'URL dans le background script
      chrome.storage.local.set({ 'apiBaseUrl': newUrl }, () => {
        chrome.runtime.sendMessage({ action: 'updateApiUrl', url: newUrl }, () => {
          updateStatus();
        });
      });
      serverConfigPanel.style.display = 'none';
    }
  });
  
  // Gestion de la réponse de connexion
  function handleLoginResponse(response) {
    // Réactiver le bouton
    loginButton.disabled = false;
    loginButton.textContent = 'Se connecter';
    
    // Vérifier d'abord s'il y a eu une erreur de communication
    if (chrome.runtime.lastError) {
      console.error('Erreur de communication:', chrome.runtime.lastError);
      showError('Erreur de communication avec le serveur');
      return;
    }
    
    console.log('Réponse de login reçue:', response);
    
    // Gérer la réponse
    if (response && response.success) {
      // Mode debug: accepter le mot de passe 'debug' pour les tests locaux
      if (passwordInput.value === 'debug') {
        console.log('Mode développement: authentification simulée');
      }
      
      handleLoginSuccess();
    } else {
      const errorMsg = response && response.error ? response.error : 'Erreur de connexion';
      showError(errorMsg);
    }
  }
  
  // Gère le succès de connexion
  function handleLoginSuccess() {
    console.log('Connexion réussie');
    
    // Indiquer au background script que l'authentification a réussi
    chrome.runtime.sendMessage({ 
      action: 'authenticationUpdated', 
      authenticated: true 
    });
    
    // Afficher un message de succès avant la redirection
    loginForm.innerHTML = `
      <div style="text-align: center; color: #28a745; margin: 20px 0;">
        <p>Connexion réussie !</p>
        <button id="continue-btn" class="btn btn-primary">Continuer</button>
      </div>
    `;
    
    document.getElementById('continue-btn').addEventListener('click', () => {
      window.location.href = '../popup.html';
    });
  }
  
  // Fonctions utilitaires simples
  function showError(message) {
    loginError.textContent = message;
    loginError.style.display = 'block';
  }
  
  // Vérification du statut du serveur via le background script
  function updateStatus() {
    chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
      // Gérer les erreurs de communication
      if (chrome.runtime.lastError) {
        console.error('Erreur lors de la vérification du statut:', chrome.runtime.lastError);
        statusIndicator.classList.remove('status-connected');
        statusIndicator.classList.add('status-disconnected');
        statusIndicator.title = 'Déconnecté du serveur';
        return;
      }
      
      console.log('Réponse de statut reçue:', response);
      
      if (response && response.status === 'connected') {
        statusIndicator.classList.remove('status-disconnected');
        statusIndicator.classList.add('status-connected');
        statusIndicator.title = 'Connecté au serveur';
        
        // Vérifier aussi l'authentification après confirmation de connexion
        chrome.runtime.sendMessage({ action: 'checkAuthentication' }, (authResponse) => {
          console.log('Statut d\'authentification:', authResponse);
          // Si authentifié, rediriger vers la page principale
          if (authResponse && authResponse.authenticated) {
            console.log('Déjà authentifié, redirection vers popup');
            // On peut rediriger directement ou attendre que l'utilisateur clique
            // window.location.href = '../popup.html';
          }
        });
      } else {
        statusIndicator.classList.remove('status-connected');
        statusIndicator.classList.add('status-disconnected');
        statusIndicator.title = 'Déconnecté du serveur';
      }
    });
  }
});