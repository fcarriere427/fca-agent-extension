// FCA-Agent - Module API

/**
 * Récupère l'URL de l'API depuis le stockage local
 * @returns {Promise<string>} URL de base de l'API
 */
export async function getApiBaseUrl() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['apiBaseUrl'], (result) => {
      resolve(result.apiBaseUrl || 'http://fca-agent.letsq.xyz/api');
    });
  });
}

/**
 * Vérifie l'état de connexion au serveur
 * @returns {Promise<boolean>} État de connexion
 */
export async function checkServerConnection() {
  try {
    const apiBaseUrl = await getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/status`, { 
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    return response.ok;
  } catch (error) {
    console.error('Erreur de connexion:', error);
    return false;
  }
}

/**
 * Exécute un test simple de l'API
 * @returns {Promise<string>} Résultat du test
 */
export async function testSimpleAPI() {
  try {
    const apiBaseUrl = await getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/tasks/hello`);
    const text = await response.text();
    return text;
  } catch (error) {
    console.error("Erreur test:", error);
    throw error;
  }
}

/**
 * Récupère une réponse complète depuis le serveur
 * @param {string} responseId - ID de la réponse à récupérer
 * @returns {Promise<string>} Réponse complète
 */
export async function fetchFullResponse(responseId) {
  try {
    const apiBaseUrl = await getApiBaseUrl();
    
    // Afficher l'URL complète dans la console pour le débogage
    console.log("URL appelée:", `${apiBaseUrl}/tasks/response/${responseId}`);
    
    // Utiliser fetch standard pour récupérer la réponse
    const response = await fetch(`${apiBaseUrl}/tasks/response/${responseId}`, {
      method: 'GET',
      credentials: 'include'
    });
    
    console.log("Statut de la réponse:", response.status);
    
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
    
    // Récupérer le contenu en texte brut
    const textContent = await response.text();
    console.log(`Réponse reçue: ${textContent.length} caractères`);
    
    return textContent;
  } catch (error) {
    console.error('Erreur lors de la récupération de la réponse complète:', error);
    throw error;
  }
}
