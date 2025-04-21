// FCA-Agent - Script de la page de connexion (version simplifiée)
// Point d'entrée unique pour l'authentification

document.addEventListener('DOMContentLoaded', () => {
  // Éléments DOM
  const loginForm = document.getElementById('login-form');
  const statusIndicator = document.getElementById('status-indicator');
  const serverConfigBtn = document.getElementById('server-config-btn');
  const serverConfigPanel = document.getElementById('server-config-panel');
  const serverUrlInput = document.getElementById('server-url');
  const saveServerConfig = document.getElementById('save-server-config');
  const loginError = document.getElementById('login-error');
  const checkAuthBtn = document.getElementById('check-auth-btn');
  const authResult = document.getElementById('auth-result');
  
  // Variables globales
  let apiBaseUrl = '';
  
  // Initialisation
  initializeApp();
  
  // Vérification du statut de connexion au serveur
  checkServerStatus();
  
  // Gestionnaire pour le formulaire de connexion
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const password = document.getElementById('login-password').value;
    
    if (!password) {
      displayError(loginError, 'Veuillez saisir un mot de passe');
      return;
    }
    
    loginError.textContent = '';
    
    try {
      // Affichage d'un message de chargement
      const loadingMsg = document.createElement('div');
      loadingMsg.textContent = 'Connexion en cours...';
      loadingMsg.style.marginTop = '10px';
      loginForm.appendChild(loadingMsg);
      
      const result = await login(password);
      
      // Suppression du message de chargement
      loginForm.removeChild(loadingMsg);
      
      if (result.success) {
        // Montrer un message de succès à la place de rediriger immédiatement
        loginForm.innerHTML = `
          <div style="text-align: center; color: #28a745;">
            <p>Connexion réussie!</p>
            <button id="continue-btn" class="btn btn-primary" style="margin-top: 15px;">Continuer</button>
          </div>
        `;
        
        // Ajouter l'événement pour continuer
        document.getElementById('continue-btn').addEventListener('click', () => {
          window.location.href = '../popup.html';
        });
      } else {
        displayError(loginError, result.error || 'Erreur de connexion');
      }
    } catch (error) {
      displayError(loginError, error.message || 'Erreur de connexion');
    }
  });
  
  // Configuration du serveur
  serverConfigBtn.addEventListener('click', () => {
    serverConfigPanel.style.display = serverConfigPanel.style.display === 'none' ? 'block' : 'none';
  });
  
  saveServerConfig.addEventListener('click', () => {
    const newUrl = serverUrlInput.value.trim();
    if (newUrl) {
      // Sauvegarder la configuration
      chrome.storage.local.set({ 'apiBaseUrl': newUrl }, () => {
        apiBaseUrl = newUrl;
        serverConfigPanel.style.display = 'none';
        checkServerStatus();
      });
    }
  });
  
  // Vérification d'authentification
  checkAuthBtn.addEventListener('click', async () => {
    try {
      authResult.textContent = 'Vérification en cours...';
      authResult.style.display = 'block';
      authResult.style.color = '#333';
      
      const isAuthenticated = await checkAuthentication();
      
      if (isAuthenticated) {
        authResult.textContent = 'Vous êtes authentifié!';
        authResult.style.color = '#28a745';
      } else {
        authResult.textContent = 'Vous n\'êtes pas authentifié';
        authResult.style.color = '#dc3545';
      }
    } catch (error) {
      authResult.textContent = `Erreur: ${error.message}`;
      authResult.style.color = '#dc3545';
    }
  });
  
  // Fonctions
  
  // Initialisation de l'application
  function initializeApp() {
    // Détecter si cette instance est en cours d'initialisation
    if (window.isInitializing) {
      console.log('Initialisation déjà en cours, annulation de la duplication');
      return;
    }
    
    window.isInitializing = true;
    
    // Récupérer la configuration du serveur
    chrome.storage.local.get(['apiBaseUrl'], (result) => {
      if (result.apiBaseUrl) {
        apiBaseUrl = result.apiBaseUrl;
        serverUrlInput.value = apiBaseUrl;
      } else {
        // Valeur par défaut
        apiBaseUrl = 'http://fca-agent.letsq.xyz/api';
        serverUrlInput.value = apiBaseUrl;
        chrome.storage.local.set({ 'apiBaseUrl': apiBaseUrl });
      }
      
      // Utiliser le localstorage pour éviter les vérifications en boucle
      const lastCheckTime = localStorage.getItem('lastAuthCheck');
      const now = Date.now();
      
      if (!lastCheckTime || now - parseInt(lastCheckTime) > 5000) {
        // Enregistrer le temps de cette vérification
        localStorage.setItem('lastAuthCheck', now.toString());
        
        // Vérifier l'authentification une seule fois
        chrome.runtime.sendMessage({ action: 'getUserData' }, (response) => {
          window.isInitializing = false;
          // Si déjà authentifié, rediriger
          if (response && response.isAuthenticated) {
            window.location.href = '../popup.html';
          }
        });
      } else {
        console.log('Vérification d’auth effectuée récemment, utilisation du cache');
        window.isInitializing = false;
      }
    });
  }
  
  // Connexion utilisateur
  async function login(password) {
    try {
      console.log('Tentative de connexion');
      console.log('URL API:', apiBaseUrl);
      
      const response = await fetch(`${apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        credentials: 'include', // Important: inclure les cookies
        mode: 'cors'
      });
      
      console.log('Réponse du serveur:', response.status);
      
      const data = await response.json();
      console.log('Données reçues du serveur:', JSON.stringify(data));
      
      if (!response.ok) {
        throw new Error(data.error || 'Erreur de connexion');
      }
      
      // Enregistrer le moment de la connexion
      localStorage.setItem('lastAuthUpdate', Date.now().toString());
      
      // Informer le background script (une seule fois)
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ 
          action: 'authenticationUpdated', 
          authenticated: true,
          noRefresh: true // Flag pour éviter un rafraîchissement en cascade
        }, () => {
          resolve({ success: true });
        });
      });
    } catch (error) {
      console.error('Erreur de login:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Vérifier l'authentification
  async function checkAuthentication() {
    // Vérifier si une vérification récente a déjà été faite
    const lastAuthCheck = localStorage.getItem('lastAuthCheckDirect');
    const now = Date.now();
    
    if (lastAuthCheck && now - parseInt(lastAuthCheck) < 5000) {
      console.log('Vérification directe d’auth effectuée récemment, utilisation du cache');
      return JSON.parse(localStorage.getItem('lastAuthResult') || 'false');
    }
    
    try {
      // Enregistrer cette vérification
      localStorage.setItem('lastAuthCheckDirect', now.toString());
      
      const response = await fetch(`${apiBaseUrl}/auth/check`, {
        method: 'GET',
        credentials: 'include', // Important: inclure les cookies
        mode: 'cors'
      });
      
      if (!response.ok) {
        throw new Error(`Erreur serveur: ${response.status}`);
      }
      
      const data = await response.json();
      const result = data.authenticated === true;
      
      // Mémoriser le résultat
      localStorage.setItem('lastAuthResult', JSON.stringify(result));
      return result;
    } catch (error) {
      console.error('Erreur lors de la vérification d\'authentification:', error);
      return false;
    }
  }
  
  // Vérifier le statut du serveur via le background script
  function checkServerStatus() {
    if (!apiBaseUrl) return;
    
    // Vérifier si une vérification récente a déjà été faite
    const lastStatusCheck = localStorage.getItem('lastStatusCheck');
    const now = Date.now();
    
    if (lastStatusCheck && now - parseInt(lastStatusCheck) < 5000) {
      console.log('Vérification de statut effectuée récemment, utilisation du cache');
      return;
    }
    
    // Enregistrer cette vérification
    localStorage.setItem('lastStatusCheck', now.toString());
    
    // Utiliser le background script pour vérifier le statut du serveur
    chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
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
  
  // Afficher un message d'erreur
  function displayError(element, message) {
    element.textContent = message;
    element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
});