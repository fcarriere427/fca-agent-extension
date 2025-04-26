// FCA-Agent - Module de configuration

import { configLog } from './config-logger.js';

// Configuration globale
let API_BASE_URL = 'https://fca-agent.letsq.xyz/api';

// Méthodes d'accès à la configuration
export function getApiUrl() {
  return API_BASE_URL;
}

export function setApiUrl(url) {
  API_BASE_URL = url;
  configLog(`URL API modifiée: ${url}`);
  chrome.storage.local.set({ 'apiBaseUrl': API_BASE_URL });
}

// Chargement initial de la configuration
export function loadInitialConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['apiBaseUrl'], (result) => {
      if (result.apiBaseUrl) {
        API_BASE_URL = result.apiBaseUrl;
        configLog(`URL API chargée: ${API_BASE_URL}`);
      }
      resolve();
    });
  });
}

// Configuration par défaut lors de l'installation/mise à jour
export function setDefaultConfig() {
  chrome.storage.local.get(['apiBaseUrl'], (result) => {
    if (!result.apiBaseUrl) {
      API_BASE_URL = 'http://fca-agent.letsq.xyz/api';
      configLog(`URL API par défaut définie: ${API_BASE_URL}`);
      chrome.storage.local.set({ 'apiBaseUrl': API_BASE_URL });
    } else {
      configLog(`URL API déjà configurée: ${result.apiBaseUrl}`);
    }
  });
}
