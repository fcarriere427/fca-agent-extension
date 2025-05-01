// FCA-Agent - Module d'authentification

import { authUiLog } from './logger-module.js';

/**
 * Vérifie que l'utilisateur est authentifié
 * @param {Function} callback - Fonction à exécuter si authentifié
 */
export function checkAuthOnce(callback) {
  authUiLog('Vérification du statut d\'authentification');
  
  try {
    chrome.runtime.sendMessage({ action: 'checkAuthentication' }, (response) => {
      // Vérifier d'abord s'il y a eu une erreur de communication
      if (chrome.runtime.lastError) {
        authUiLog(`Erreur de communication: ${chrome.runtime.lastError.message}`, 'error');
        // Page de login supprimée - authentification par clé API fixe uniquement
        return;
      }
      
      authUiLog(`Réponse reçue: ${JSON.stringify(response)}`);
      
      if (!response || !response.authenticated) {
        authUiLog('Non authentifié');
        // Page de login supprimée - authentification par clé API fixe uniquement
        return;
      }
      
      authUiLog('Authentification OK');
      if (callback) callback();
    });
  } catch (error) {
    authUiLog(`Exception lors de la vérification d'authentification: ${error.message}`, 'error');
    // Page de login supprimée - authentification par clé API fixe uniquement
  }
}

/**
 * Gère la déconnexion de l'utilisateur
 */
export function handleLogout() {
  authUiLog('Tentative de déconnexion');
  
  try {
    chrome.runtime.sendMessage({ action: 'logout' }, (response) => {
      // Gérer les erreurs de communication
      if (chrome.runtime.lastError) {
        authUiLog(`Erreur lors de la déconnexion: ${chrome.runtime.lastError.message}`, 'error');
        // Rediriger quand même pour éviter les problèmes d'authentification
        // Page de login supprimée - authentification par clé API fixe uniquement
        return;
      }
      
      authUiLog(`Réponse de déconnexion: ${JSON.stringify(response)}`);
      
      if (response && response.success) {
        authUiLog('Déconnexion réussie, redirection vers login');
        // Page de login supprimée - authentification par clé API fixe uniquement
      } else {
        authUiLog(`Erreur lors de la déconnexion: ${response ? response.error : 'Aucune réponse'}`, 'error');
        // Page de login supprimée - authentification par clé API fixe uniquement
      }
    });
  } catch (error) {
    authUiLog(`Exception lors de la déconnexion: ${error.message}`, 'error');
    // Page de login supprimée - authentification par clé API fixe uniquement
  }
}
