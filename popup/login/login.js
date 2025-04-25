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
  
  // Nouvelle approche : on essaie une connexion directe en http, en évitant HTTPS et en ciblant directement l'IP si nécessaire
  async function attemptLogin(password) {
    try {
      console.log('Tentative de connexion directe');
      
      // Désactiver le bouton pendant la connexion
      loginButton.disabled = true;
      loginButton.textContent = 'Connexion en cours...';
      
      // Version simplifiée - connexion directe au serveur en contournant le DNS
      // On essaie d'abord une IP locale (si disponible)
      let loginUrl = 'http://192.168.1.100:3001/api/auth/login';
      
      try {
        // Essayer d'abord une connexion directe
        const response = await fetch(loginUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
          credentials: 'include',
          mode: 'cors'
        });
        
        if (response.ok) {
          handleLoginSuccess();
          return;
        } else {
          // Si la première tentative échoue, on essaie avec l'URL standard
          throw new Error('Première tentative échouée, essai avec URL standard');
        }
      } catch (firstError) {
        console.log('Première tentative échouée, essai avec URL standard:', firstError);
        
        // Si la tentative directe échoue, on essaie l'URL régulière
        loginUrl = serverUrl.includes('/api') 
          ? `${serverUrl}/auth/login`
          : `${serverUrl}/api/auth/login`;
        
        try {
          const response = await fetch(loginUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
            credentials: 'include',
            mode: 'cors'
          });
          
          const data = await response.json();
          
          if (response.ok) {
            handleLoginSuccess();
          } else {
            showError(data.error || 'Erreur de connexion');
          }
        } catch (secondError) {
          console.error('Deuxième tentative échouée:', secondError);
          showError('Erreur de connexion au serveur');
        }
      }
      
      // Réactiver le bouton
      loginButton.disabled = false;
      loginButton.textContent = 'Se connecter';
    } catch (error) {
      console.error('Erreur globale de connexion:', error);
      loginButton.disabled = false;
      loginButton.textContent = 'Se connecter';
      showError('Erreur de connexion au serveur');
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
  
  // Vérification directe du statut du serveur sans passer par le background script
  async function updateStatus() {
    try {
      // Essayer d'abord l'IP locale si disponible
      let statusUrl = 'http://192.168.1.100:3001/api/status';
      
      try {
        // Tentative avec IP directe
        const response = await fetch(statusUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          mode: 'cors'
        });
        
        if (response.ok) {
          statusIndicator.classList.remove('status-disconnected');
          statusIndicator.classList.add('status-connected');
          statusIndicator.title = 'Connecté au serveur';
          return;
        }
      } catch (firstError) {
        console.log('Vérification du statut avec IP locale échouée:', firstError);
      }
      
      // Seconde tentative avec l'URL normale
      statusUrl = serverUrl.includes('/api') 
        ? `${serverUrl}/status`
        : `${serverUrl}/api/status`;
        
      try {
        const response = await fetch(statusUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          mode: 'cors'
        });
        
        if (response.ok) {
          statusIndicator.classList.remove('status-disconnected');
          statusIndicator.classList.add('status-connected');
          statusIndicator.title = 'Connecté au serveur';
        } else {
          throw new Error('Statut non-OK');
        }
      } catch (secondError) {
        console.error('Vérification du statut échouée:', secondError);
        statusIndicator.classList.remove('status-connected');
        statusIndicator.classList.add('status-disconnected');
        statusIndicator.title = 'Déconnecté du serveur';
      }
    } catch (error) {
      console.error('Erreur globale de vérification du statut:', error);
      statusIndicator.classList.remove('status-connected');
      statusIndicator.classList.add('status-disconnected');
      statusIndicator.title = 'Déconnecté du serveur';
    }
  }
});