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
    
    // Tenter la connexion
    attemptLogin(password);
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
  
  // Fonction de connexion utilisant le proxy dans le background script
  async function attemptLogin(password) {
    try {
      console.log('Tentative de connexion via le background script proxy');
      
      // Désactiver le bouton pendant la connexion
      loginButton.disabled = true;
      loginButton.textContent = 'Connexion en cours...';
      
      // Envoyer la requête au background script pour contourner CORS
      chrome.runtime.sendMessage(
        { action: 'proxyLogin', password: password },
        function(response) {
          // Réactiver le bouton
          loginButton.disabled = false;
          loginButton.textContent = 'Se connecter';
          
          console.log('Réponse reçue du proxy de connexion:', response);
          
          if (response && response.success) {
            console.log('Connexion réussie via proxy');
            
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
          } else {
            const errorMsg = response && response.error ? response.error : 'Erreur de connexion';
            showError(errorMsg);
          }
        }
      );
    } catch (error) {
      console.error('Erreur de connexion:', error);
      loginButton.disabled = false;
      loginButton.textContent = 'Se connecter';
      showError('Erreur de connexion au serveur');
    }
  }
  
  // Fonctions utilitaires simples
  function showError(message) {
    loginError.textContent = message;
    loginError.style.display = 'block';
  }
  
  function updateStatus() {
    // Utiliser le background script pour vérifier le statut
    chrome.runtime.sendMessage({ action: 'getStatus' }, function(response) {
      console.log('Statut du serveur via background script:', response);
      
      if (response && response.status === 'connected') {
        statusIndicator.classList.remove('status-disconnected');
        statusIndicator.classList.add('status-connected');
        statusIndicator.title = 'Connecté au serveur';
      } else {
        statusIndicator.classList.remove('status-connected');
        statusIndicator.classList.add('status-disconnected');
        statusIndicator.title = 'Déconnecté du serveur';
      }
    });
  }
});