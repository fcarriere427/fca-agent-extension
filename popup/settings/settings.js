// FCA-Agent - Script de la page de paramètres

document.addEventListener('DOMContentLoaded', () => {
  // Éléments DOM
  const backBtn = document.getElementById('back-btn');
  const profileUsername = document.getElementById('profile-username');
  const profileEmail = document.getElementById('profile-email');
  const profileCreated = document.getElementById('profile-created');
  const profileLastLogin = document.getElementById('profile-last-login');
  const changePasswordForm = document.getElementById('change-password-form');
  const currentPasswordInput = document.getElementById('current-password');
  const newPasswordInput = document.getElementById('new-password');
  const confirmPasswordInput = document.getElementById('confirm-password');
  const passwordError = document.getElementById('password-error');
  const passwordSuccess = document.getElementById('password-success');
  const serverUrlInput = document.getElementById('server-url');
  const saveServerBtn = document.getElementById('save-server-btn');
  const serverStatus = document.getElementById('server-status');
  const logoutBtn = document.getElementById('logout-btn');
  
  // Variables globales
  let apiBaseUrl = '';
  
  // Initialisation
  initializePage();
  
  // Gestionnaires d'événements
  
  // Retour à la page principale
  backBtn.addEventListener('click', () => {
    window.location.href = '../popup.html';
  });
  
  // Changement de mot de passe
  changePasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    
    // Réinitialiser les messages
    passwordError.textContent = '';
    passwordSuccess.textContent = '';
    
    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      passwordError.textContent = 'Tous les champs sont requis';
      return;
    }
    
    if (newPassword !== confirmPassword) {
      passwordError.textContent = 'Les nouveaux mots de passe ne correspondent pas';
      return;
    }
    
    // Essayer de changer le mot de passe
    try {
      const result = await changePassword(currentPassword, newPassword);
      if (result.success) {
        passwordSuccess.textContent = result.message || 'Mot de passe mis à jour avec succès';
        changePasswordForm.reset();
      } else {
        passwordError.textContent = result.error || 'Erreur lors du changement de mot de passe';
      }
    } catch (error) {
      passwordError.textContent = error.message || 'Erreur de connexion';
    }
  });
  
  // Enregistrement de l'URL du serveur
  saveServerBtn.addEventListener('click', () => {
    const url = serverUrlInput.value.trim();
    if (!url) {
      serverStatus.textContent = 'URL invalide';
      serverStatus.className = 'status-message error';
      return;
    }
    
    // Sauvegarder l'URL
    chrome.storage.local.set({ 'apiBaseUrl': url }, () => {
      apiBaseUrl = url;
      
      // Informer le background script
      chrome.runtime.sendMessage({ action: 'updateApiUrl', url: apiBaseUrl });
      
      // Tester la connexion
      testServerConnection(url)
        .then(isConnected => {
          if (isConnected) {
            serverStatus.textContent = 'Connexion établie avec succès';
            serverStatus.className = 'status-message success';
          } else {
            serverStatus.textContent = 'Impossible de se connecter au serveur';
            serverStatus.className = 'status-message error';
          }
        })
        .catch(() => {
          serverStatus.textContent = 'Erreur lors de la tentative de connexion';
          serverStatus.className = 'status-message error';
        });
    });
  });
  
  // Déconnexion
  logoutBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'logout' }, () => {
      window.location.href = '../login/login.html';
    });
  });
  
  // Fonctions
  
  // Initialisation de la page
  function initializePage() {
    // Vérifier l'authentification
    chrome.runtime.sendMessage({ action: 'validateToken' }, (response) => {
      if (!response || !response.success) {
        // Rediriger vers la page de connexion
        window.location.href = '../login/login.html';
        return;
      }
      
      // Charger les données du profil
      loadProfileData();
      
      // Charger la configuration du serveur
      loadServerConfig();
    });
  }
  
  // Charger les données du profil utilisateur
  async function loadProfileData() {
    try {
      const profile = await fetchProfileData();
      
      if (profile && profile.user) {
        // Afficher les informations du profil
        profileUsername.textContent = profile.user.username || '-';
        profileEmail.textContent = profile.user.email || '-';
        
        // Formater les dates
        if (profile.user.created_at) {
          const createdDate = new Date(profile.user.created_at);
          profileCreated.textContent = formatDate(createdDate);
        }
        
        if (profile.user.last_login) {
          const lastLoginDate = new Date(profile.user.last_login);
          profileLastLogin.textContent = formatDate(lastLoginDate);
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement du profil:', error);
    }
  }
  
  // Récupérer les données du profil depuis le serveur
  async function fetchProfileData() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'fetchProfile' },
        (response) => {
          if (response && response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response?.error || 'Erreur de récupération du profil'));
          }
        }
      );
    });
  }
  
  // Charger la configuration du serveur
  function loadServerConfig() {
    chrome.storage.local.get('apiBaseUrl', (result) => {
      if (result.apiBaseUrl) {
        apiBaseUrl = result.apiBaseUrl;
        serverUrlInput.value = apiBaseUrl;
      }
    });
  }
  
  // Changer le mot de passe
  async function changePassword(currentPassword, newPassword) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { 
          action: 'executeTask', 
          task: 'changePassword', 
          data: { currentPassword, newPassword } 
        },
        (response) => {
          if (response) {
            resolve(response);
          } else {
            reject(new Error('Erreur lors du changement de mot de passe'));
          }
        }
      );
    });
  }
  
  // Tester la connexion au serveur
  async function testServerConnection(url) {
    try {
      const response = await fetch(`${url}/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      return response.ok;
    } catch (error) {
      console.error('Erreur de connexion au serveur:', error);
      return false;
    }
  }
  
  // Formater une date
  function formatDate(date) {
    if (!(date instanceof Date) || isNaN(date)) {
      return '-';
    }
    
    return date.toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
});