/**
 * FCA-Agent - Configuration spécifique à l'interface utilisateur
 * 
 * Ce module gère les configurations liées à l'interface utilisateur de l'extension
 */

import { getConfig, updateConfig } from './index.js';
import { createLogger } from '../utils/logger.js';

// Initialiser le logger
const logger = createLogger('CONFIG:UI');

/**
 * Récupère la configuration de l'interface utilisateur
 * @returns {Object} Configuration UI
 */
export function getUIConfig() {
  return {
    theme: getConfig('theme'),
    popupWidth: getConfig('popupWidth'),
    popupHeight: getConfig('popupHeight'),
    showNotifications: getConfig('showNotifications')
  };
}

/**
 * Change le thème de l'interface
 * @param {string} theme - 'light' ou 'dark'
 * @returns {Promise<void>}
 */
export async function setTheme(theme) {
  if (theme !== 'light' && theme !== 'dark') {
    logger.error(`Thème invalide: ${theme}`);
    throw new Error('Le thème doit être "light" ou "dark"');
  }
  
  logger.info(`Changement de thème: ${getConfig('theme')} -> ${theme}`);
  await updateConfig('theme', theme);
  
  // Appliquer le thème
  document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Active ou désactive les notifications
 * @param {boolean} enabled - Activer les notifications
 * @returns {Promise<void>}
 */
export async function setNotifications(enabled) {
  logger.info(`${enabled ? 'Activation' : 'Désactivation'} des notifications`);
  await updateConfig('showNotifications', enabled);
}

/**
 * Vérifie si les notifications sont activées
 * @returns {boolean} True si les notifications sont activées
 */
export function areNotificationsEnabled() {
  return getConfig('showNotifications');
}

/**
 * Affiche une notification (si activées)
 * @param {string} title - Titre de la notification
 * @param {string} message - Message de la notification
 */
export function showNotification(title, message) {
  if (!areNotificationsEnabled()) {
    logger.debug('Notification ignorée (notifications désactivées)');
    return;
  }
  
  logger.debug('Affichage d\'une notification', { title, message });
  
  chrome.notifications.create({
    type: 'basic',
    iconUrl: '/assets/icons/icon48.png',
    title: title,
    message: message
  });
}

/**
 * Initialise les configurations UI
 * Doit être appelé dans un contexte d'interface utilisateur
 */
export function initUIConfig() {
  // Appliquer le thème actuel
  const theme = getConfig('theme');
  document.documentElement.setAttribute('data-theme', theme);
  logger.debug(`Thème initialisé: ${theme}`);
}

export default {
  getUIConfig,
  setTheme,
  setNotifications,
  areNotificationsEnabled,
  showNotification,
  initUIConfig
};
