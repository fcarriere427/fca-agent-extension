// FCA-Agent - Générateur d'en-têtes d'authentification simplifié
// Ce module fournit les en-têtes HTTP pour l'authentification avec le serveur

import { API_KEY, getAuthHeaders as getSimpleAuthHeaders } from '../utils/auth.js';
import { createLogger } from '../utils/logger.js';

// Création d'une instance de logger spécifique pour ce module
const logger = createLogger("auth-headers-simple");

/**
 * Retourne les en-têtes d'authentification avec la clé API
 * @returns {Promise<Object>} En-têtes HTTP pour l'authentification
 */
export async function getAuthHeaders() {
  try {
    logger.debug("Génération des en-têtes d'authentification");
    const headers = getSimpleAuthHeaders();
    logger.info("En-têtes d'authentification générés avec succès");
    return headers;
  } catch (error) {
    logger.error("Erreur lors de la génération des en-têtes d'authentification", null, error);
    throw new Error(`Impossible de générer les en-têtes: ${error.message}`);
  }
}

/**
 * Vérifie si l'authentification est configurée correctement
 * @returns {Promise<boolean>} Vrai si la clé API est définie
 */
export async function isAuthConfigured() {
  const isConfigured = !!API_KEY && API_KEY.length > 0;
  logger.debug("Vérification de la configuration d'authentification", { isConfigured });
  return isConfigured;
}

export default {
  getAuthHeaders,
  isAuthConfigured
};