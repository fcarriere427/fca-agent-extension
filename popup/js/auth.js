// FCA-Agent - Module d'authentification

/**
 * Vérifie que l'utilisateur est authentifié
 * @param {Function} callback - Fonction à exécuter si authentifié
 */
export function checkAuthOnce(callback) {
  chrome.runtime.sendMessage({ action: 'getUserData' }, (response) => {
    if (!response || !response.isAuthenticated) {
      console.log('Non authentifié, redirection vers login');
      window.location.href = 'login/login.html';
      return;
    }
    
    console.log('Authentification OK');
    if (callback) callback();
  });
}

/**
 * Gère la déconnexion de l'utilisateur
 */
export function handleLogout() {
  chrome.runtime.sendMessage({ action: 'logout' }, (response) => {
    if (response && response.success) {
      // Rediriger vers la page de connexion
      window.location.href = 'login/login.html';
    }
  });
}
