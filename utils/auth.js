// FCA-Agent - Utilitaire d'authentification (version avec clé API fixe uniquement)

/**
 * Vérifie si l'utilisateur est authentifié (avec clé API fixe, c'est toujours le cas)
 * @returns {Promise<boolean>} - Toujours vrai car clé API fixe
 */
async function isAuthenticated() {
  return true; // Avec une clé API fixe, toujours authentifié
}

/**
 * Récupère les informations de l'utilisateur (version avec clé API fixe)
 * @returns {Promise<Object>} - Information d'authentification avec clé API fixe
 */
async function getUserData() {
  return { isAuthenticated: true }; // Toujours authentifié avec clé API fixe
}

/**
 * Fonction conservée pour compatibilité (ne fait rien avec clé API fixe)
 * @returns {Promise<boolean>} - Toujours vrai
 */
async function logout() {
  return true; // Ne fait rien avec clé API fixe
}

/**
 * Fonction maintenue pour compatibilité (avec clé API fixe, toujours authentifié)
 * @param {string} loginPath - Chemin vers la page de connexion (non utilisé)
 * @returns {Promise<boolean>} - Toujours vrai avec clé API fixe
 */
async function requireAuth(loginPath = 'login/login.html') {
  // Avec clé API fixe, toujours authentifié, pas besoin de redirection
  return true;
}

export {
  isAuthenticated,
  getUserData,
  logout,
  requireAuth
};