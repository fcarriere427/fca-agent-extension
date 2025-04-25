// FCA-Agent - Utilitaire d'authentification (version simplifiée)

/**
 * Vérifie si l'utilisateur est authentifié
 * @returns {Promise<boolean>} - Vrai si l'utilisateur est authentifié
 */
async function isAuthenticated() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'checkAuthentication' }, (response) => {
      resolve(response && response.authenticated === true);
    });
  });
}

/**
 * Récupère les informations de l'utilisateur connecté
 * @returns {Promise<Object|null>} - Les données utilisateur ou null si non connecté
 */
async function getUserData() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getUserData' }, (response) => {
      if (response && response.isAuthenticated) {
        resolve({ isAuthenticated: true });
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * Déconnecte l'utilisateur
 * @returns {Promise<boolean>} - Vrai si la déconnexion a réussi
 */
async function logout() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'logout' }, (response) => {
      resolve(response && response.success === true);
    });
  });
}

/**
 * Vérifie l'authentification et redirige vers la page de connexion si non authentifié
 * @param {string} loginPath - Chemin vers la page de connexion
 * @returns {Promise<boolean>} - Vrai si l'utilisateur est authentifié
 */
async function requireAuth(loginPath = 'login/login.html') {
  const isAuth = await isAuthenticated();
  if (!isAuth && window.location.href.indexOf(loginPath) === -1) {
    window.location.href = loginPath;
    return false;
  }
  return isAuth;
}

export {
  isAuthenticated,
  getUserData,
  logout,
  requireAuth
};