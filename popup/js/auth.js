// FCA-Agent - Module d'authentification

/**
 * Vérifie que l'utilisateur est authentifié
 * @param {Function} callback - Fonction à exécuter si authentifié
 */
export function checkAuthOnce(callback) {
  chrome.runtime.sendMessage({ action: 'checkAuthentication' }, (response) => {
    // Vérifier d'abord s'il y a eu une erreur de communication
    if (chrome.runtime.lastError) {
      console.error('Erreur de communication avec le background script:', chrome.runtime.lastError);
      window.location.href = 'login/login.html';
      return;
    }
    
    if (!response || !response.authenticated) {
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
    // Gérer les erreurs de communication
    if (chrome.runtime.lastError) {
      console.error('Erreur lors de la déconnexion:', chrome.runtime.lastError);
      // Rediriger quand même pour éviter les problèmes d'authentification
      window.location.href = 'login/login.html';
      return;
    }
    
    if (response && response.success) {
      // Rediriger vers la page de connexion
      window.location.href = 'login/login.html';
    } else {
      console.error('Erreur lors de la déconnexion:', response ? response.error : 'Aucune réponse');
      // Rediriger quand même pour éviter les problèmes d'authentification
      window.location.href = 'login/login.html';
    }
  });
}
