// FCA-Agent - Script de la page de connexion

document.addEventListener('DOMContentLoaded', () => {
  // Éléments DOM
  const loginTab = document.getElementById('login-tab');
  const registerTab = document.getElementById('register-tab');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const statusIndicator = document.getElementById('status-indicator');
  const serverConfigBtn = document.getElementById('server-config-btn');
  const serverConfigPanel = document.getElementById('server-config-panel');
  const serverUrlInput = document.getElementById('server-url');
  const saveServerConfig = document.getElementById('save-server-config');
  const loginError = document.getElementById('login-error');
  const registerError = document.getElementById('register-error');
  
  // Variables globales
  let apiBaseUrl = '';
  
  // Initialisation
  initializeApp();
  
  // Vérification du statut de connexion au serveur
  checkServerStatus();
  
  // Gestionnaires d'événements pour les onglets
  loginTab.addEventListener('click', () => {
    setActiveTab('login');
  });
  
  registerTab.addEventListener('click', () => {
    setActiveTab('register');
  });
  
  // Gestionnaire pour le formulaire de connexion
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!username || !password) {
      displayError(loginError, 'Veuillez saisir un nom d\'utilisateur et un mot de passe');
      return;
    }
    
    loginError.textContent = '';
    
    try {
      // Affichage d'un message de chargement
      const loadingMsg = document.createElement('div');
      loadingMsg.textContent = 'Connexion en cours...';
      loadingMsg.style.marginTop = '10px';
      loginForm.appendChild(loadingMsg);
      
      const result = await login(username, password);
      
      // Suppression du message de chargement
      loginForm.removeChild(loadingMsg);
      
      if (result.success) {
        // Montrer un message de succès à la place de rediriger immédiatement
        loginForm.innerHTML = `
          <div style="text-align: center; color: #28a745;">
            <p>Connexion réussie!</p>
            <p>Vous pouvez maintenant vérifier le token et tester sa validité.</p>
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
  
  // Gestionnaire pour le formulaire d'inscription
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('register-username').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    
    if (!username || !password) {
      displayError(registerError, 'Veuillez saisir un nom d\'utilisateur et un mot de passe');
      return;
    }
    
    if (password !== confirmPassword) {
      displayError(registerError, 'Les mots de passe ne correspondent pas');
      return;
    }
    
    registerError.textContent = '';
    
    try {
      const result = await register(username, password, email);
      if (result.success) {
        // Connexion automatique après inscription réussie
        const loginResult = await login(username, password);
        if (loginResult.success) {
          window.location.href = '../popup.html';
        } else {
          // Redirection vers l'onglet de connexion en cas d'échec
          setActiveTab('login');
          displayError(loginError, 'Inscription réussie ! Veuillez vous connecter.');
        }
      } else {
        displayError(registerError, result.error || 'Erreur lors de l\'inscription');
      }
    } catch (error) {
      displayError(registerError, error.message || 'Erreur lors de l\'inscription');
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
  
  // Bouton d'affichage des tokens (debug)
  const showTokenBtn = document.getElementById('show-token-btn');
  const tokenDisplay = document.getElementById('token-display');
  const verifyTokenBtn = document.getElementById('verify-token-btn');
  const verifyResult = document.getElementById('verify-result');
  
  if (showTokenBtn && tokenDisplay) {
    showTokenBtn.addEventListener('click', () => {
      chrome.storage.session.get(['accessToken', 'refreshToken'], (result) => {
        if (result.accessToken && result.refreshToken) {
          tokenDisplay.innerHTML = `
            <strong>Access Token:</strong><br>
            ${result.accessToken.substring(0, 40)}...<br><br>
            <strong>Refresh Token:</strong><br>
            ${result.refreshToken.substring(0, 40)}...<br><br>
            <strong>Format pour API:</strong><br>
            Authorization: Bearer ${result.accessToken}
          `;
          tokenDisplay.style.display = 'block';
        } else {
          tokenDisplay.textContent = 'Aucun token stocké';
          tokenDisplay.style.display = 'block';
        }
      });
    });
  }
  
  if (verifyTokenBtn && verifyResult) {
    verifyTokenBtn.addEventListener('click', async () => {
      chrome.storage.session.get(['accessToken', 'refreshToken'], async (result) => {
        if (!result.accessToken) {
          verifyResult.textContent = 'Aucun token à vérifier';
          verifyResult.style.display = 'block';
          verifyResult.style.color = '#dc3545';
          return;
        }
        
        try {
          verifyResult.textContent = 'Vérification en cours...';
          verifyResult.style.display = 'block';
          verifyResult.style.color = '#333';
          
          // Utiliser la méthode validateToken du background script
          chrome.runtime.sendMessage({ action: 'validateToken' }, (response) => {
            if (response && response.success) {
              verifyResult.textContent = 'Token valide!';
              verifyResult.style.color = '#28a745';
            } else {
              verifyResult.textContent = 'Token invalide ou expiré';
              verifyResult.style.color = '#dc3545';
            }
          });
        } catch (error) {
          verifyResult.textContent = `Erreur lors de la vérification: ${error.message}`;
          verifyResult.style.color = '#dc3545';
        }
      });
    });
  }
  
  // Bouton de test d'accès au profil
  const testProfileBtn = document.getElementById('test-profile-btn');
  const profileResult = document.getElementById('profile-result');
  
  if (testProfileBtn && profileResult) {
    testProfileBtn.addEventListener('click', async () => {
      chrome.storage.session.get(['accessToken'], async (result) => {
        if (!result.accessToken) {
          profileResult.textContent = 'Aucun token disponible';
          profileResult.style.display = 'block';
          profileResult.style.color = '#dc3545';
          return;
        }
        
        try {
          profileResult.textContent = 'Test d\'accès au profil en cours...';
          profileResult.style.display = 'block';
          profileResult.style.color = '#333';
          
          // Utiliser fetchProfileData du background script
          chrome.runtime.sendMessage({ action: 'fetchProfile' }, (response) => {
            if (response && response.success && response.data) {
              const data = response.data;
              profileResult.innerHTML = `
                <div style="color: #28a745;">
                  <strong>Profil accessible!</strong><br>
                  Utilisateur: ${data.user?.username || 'Inconnu'}<br>
                  Email: ${data.user?.email || 'Non défini'}<br>
                  Créé le: ${data.user?.created_at || 'Inconnu'}
                </div>
              `;
            } else {
              profileResult.innerHTML = `
                <div style="color: #dc3545;">
                  <strong>Erreur</strong><br>
                  Message: ${response?.error || 'Erreur inconnue'}
                </div>
              `;
            }
          });
        } catch (error) {
          profileResult.textContent = `Erreur de requête: ${error.message}`;
          profileResult.style.color = '#dc3545';
        }
      });
    });
  }
  
  // Fonctions
  
  // Initialisation de l'application
  function initializeApp() {
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
      
      // Vérifier si l'utilisateur est déjà connecté via les tokens en session storage
      chrome.runtime.sendMessage({ action: 'validateToken' }, (response) => {
        if (response && response.success) {
          window.location.href = '../popup.html';
        }
      });
    });
  }
  
  // Connexion utilisateur
  async function login(username, password) {
    try {
      console.log('Tentative de connexion avec', username);
      console.log('URL API:', apiBaseUrl);
      
      const response = await fetch(`${apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        mode: 'cors'
      });
      
      console.log('Réponse du serveur:', response.status);
      
      const data = await response.json();
      console.log('Données reçues du serveur:', JSON.stringify(data));
      
      if (!response.ok) {
        throw new Error(data.error || 'Erreur de connexion');
      }
      
      if (!data.accessToken || !data.refreshToken) {
        console.error('Erreur: Token d\'accès ou token de rafraîchissement manquant dans la réponse');
        throw new Error('Réponse du serveur invalide ou incomplète');
      }
      
      console.log('Tokens reçus du serveur:');
      console.log('- Access token:', data.accessToken.substring(0, 20) + '...');
      console.log('- Refresh token:', data.refreshToken.substring(0, 20) + '...');
      
      // Sauvegarde des tokens et données utilisateur
      return new Promise((resolve) => {
        // Utiliser uniquement chrome.storage.session pour les tokens
        chrome.storage.session.set({ 
          'accessToken': data.accessToken, 
          'refreshToken': data.refreshToken,
          'userData': data.user,
          'tokenTimestamp': Date.now()
        }, () => {
          console.log('Tokens et données utilisateur sauvegardés en session storage');
          
          // Sauvegarder uniquement l'URL API en local storage
          chrome.storage.local.set({
            'apiBaseUrl': apiBaseUrl
          });
          
          // Informer le background script
          chrome.runtime.sendMessage({ 
            action: 'setAuthTokens', 
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            userData: data.user
          }, (response) => {
            console.log('setAuthTokens response:', response);
            resolve({ success: true });
          });
        });
      });
    } catch (error) {
      console.error('Erreur de login:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Inscription utilisateur
  async function register(username, password, email = '') {
    try {
      const response = await fetch(`${apiBaseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, email })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de l\'inscription');
      }
      
      return { success: true, userId: data.userId };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  // Changement d'onglet
  function setActiveTab(tabName) {
    if (tabName === 'login') {
      loginTab.classList.add('active');
      registerTab.classList.remove('active');
      loginForm.style.display = 'flex';
      registerForm.style.display = 'none';
    } else {
      loginTab.classList.remove('active');
      registerTab.classList.add('active');
      loginForm.style.display = 'none';
      registerForm.style.display = 'flex';
    }
    
    // Réinitialiser les messages d'erreur
    loginError.textContent = '';
    registerError.textContent = '';
  }
  
  // Vérifier le statut du serveur
  function checkServerStatus() {
    if (!apiBaseUrl) return;
    
    fetch(`${apiBaseUrl}/status`, {
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
  }
  
  // Afficher un message d'erreur
  function displayError(element, message) {
    element.textContent = message;
    element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
});