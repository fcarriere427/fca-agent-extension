// FCA-Agent - Module de gestion des indicateurs de statut

let authIndicator;
let serverIndicator;

/**
 * Vérifie que les classes CSS nécessaires existent dans la feuille de style
 */
function verifyStyles() {
  console.log("STYLES: Vérification des styles CSS");
  
  const allStyleSheets = document.styleSheets;
  let statusConnectedFound = false;
  let statusDisconnectedFound = false;
  
  console.log("STYLES: Nombre de feuilles de style chargées:", allStyleSheets.length);
  
  try {
    for (let i = 0; i < allStyleSheets.length; i++) {
      const styleSheet = allStyleSheets[i];
      console.log("STYLES: Feuille de style", i, styleSheet.href);
      
      try {
        const rules = styleSheet.cssRules || styleSheet.rules;
        for (let j = 0; j < rules.length; j++) {
          const rule = rules[j];
          if (rule.selectorText) {
            if (rule.selectorText.includes('status-connected')) {
              statusConnectedFound = true;
              console.log("STYLES: Classe 'status-connected' trouvée dans", styleSheet.href);
            }
            if (rule.selectorText.includes('status-disconnected')) {
              statusDisconnectedFound = true;
              console.log("STYLES: Classe 'status-disconnected' trouvée dans", styleSheet.href);
            }
          }
        }
      } catch (e) {
        console.warn("STYLES: Impossible d'accéder aux règles CSS de", styleSheet.href, e);
      }
    }
  } catch (e) {
    console.error("STYLES: Erreur lors de la vérification des styles:", e);
  }
  
  console.log("STYLES: status-connected trouvé?", statusConnectedFound);
  console.log("STYLES: status-disconnected trouvé?", statusDisconnectedFound);
  
  // Si les classes ne sont pas trouvées, les définir directement
  if (!statusConnectedFound || !statusDisconnectedFound) {
    console.log("STYLES: Ajout manuel des styles manquants");
    const style = document.createElement('style');
    style.textContent = `
      .status-connected {
        background-color: #38a169 !important; /* Vert */
        color: white !important;
      }
      
      .status-disconnected {
        background-color: #e53e3e !important; /* Rouge */
        color: white !important;
      }
    `;
    document.head.appendChild(style);
  }
}

/**
 * Initialise les indicateurs de statut
 * @param {HTMLElement} authIndicatorElement - Élément DOM de l'indicateur d'authentification
 * @param {HTMLElement} serverIndicatorElement - Élément DOM de l'indicateur de connexion au serveur
 */
export function initStatusIndicators(authIndicatorElement, serverIndicatorElement) {
  console.log("INIT: Initialisation des indicateurs de statut");
  console.log("INIT: authIndicator", authIndicatorElement);
  console.log("INIT: serverIndicator", serverIndicatorElement);
  
  // Vérifier que les classes CSS existent
  verifyStyles();
  
  authIndicator = authIndicatorElement;
  serverIndicator = serverIndicatorElement;
  
  // S'assurer que les indicateurs sont rouges par défaut
  resetIndicators();
  
  // Surveiller les messages de mise à jour des statuts
  chrome.runtime.onMessage.addListener((message) => {
    console.log("LISTENER: Message reçu", message);
    if (message.action === 'authStatusChanged') {
      console.log("LISTENER: Mise à jour du statut d'authentification", message.status);
      updateAuthIndicator(message.status);
    } else if (message.action === 'serverStatusChanged') {
      console.log("LISTENER: Mise à jour du statut de serveur", message.status);
      updateServerIndicator(message.status);
    }
  });
  
  // Rafraîchir les statuts au démarrage
  requestStatusUpdates();
  
  // Ajouter des tooltips plus informatifs aux indicateurs
  authIndicator.title = "État d'authentification";
  serverIndicator.title = "État de connexion au serveur";
  
  // Ajouter des gestionnaires de clic pour forcer une mise à jour
  authIndicator.addEventListener('click', () => {
    console.log('Demande de mise à jour du statut d\'authentification...');
    chrome.runtime.sendMessage({ action: 'checkAuthentication' }, (response) => {
      if (response && response.authenticated) {
        updateAuthIndicator({ authenticated: response.authenticated });
      }
    });
  });
  
  serverIndicator.addEventListener('click', () => {
    console.log('Demande de mise à jour du statut du serveur...');
    chrome.runtime.sendMessage({ action: 'checkServerOnline' }, (response) => {
      if (response) {
        updateServerIndicator(response);
      }
    });
  });
}

/**
 * Remet les indicateurs à l'état déconnecté par défaut
 */
function resetIndicators() {
  if (authIndicator) {
    authIndicator.classList.remove('status-connected');
    authIndicator.classList.add('status-disconnected');
  }
  
  if (serverIndicator) {
    serverIndicator.classList.remove('status-connected');
    serverIndicator.classList.add('status-disconnected');
  }
}

/**
 * Met à jour l'indicateur d'authentification
 * @param {Object} status - Statut d'authentification
 */
function updateAuthIndicator(status) {
  if (!authIndicator) {
    console.error("AUTH INDICATOR: L'indicateur d'authentification n'est pas défini");
    return;
  }
  
  console.log("AUTH INDICATOR: Mise à jour avec le statut", status);
  
  try {
    if (status && (status.isAuthenticated || status.authenticated)) {
      console.log("AUTH INDICATOR: Passage au VERT");
      
      // Déboguer l'état initial
      console.log("Classes avant modification:", authIndicator.className);
      
      // Essayer une autre approche pour s'assurer que les classes sont bien modifiées
      authIndicator.className = "status-indicator status-connected";
      
      // Déboguer l'état final
      console.log("Classes après modification:", authIndicator.className);
      
      authIndicator.title = "Authentifié";
    } else {
      console.log("AUTH INDICATOR: Passage au ROUGE");
      
      // Déboguer l'état initial
      console.log("Classes avant modification:", authIndicator.className);
      
      // Essayer une autre approche pour s'assurer que les classes sont bien modifiées
      authIndicator.className = "status-indicator status-disconnected";
      
      // Déboguer l'état final
      console.log("Classes après modification:", authIndicator.className);
      
      authIndicator.title = "Non authentifié";
    }
  } catch (error) {
    console.error("Erreur lors de la modification des classes CSS:", error);
  }
}

/**
 * Met à jour l'indicateur de connexion au serveur
 * @param {Object} status - Statut de connexion au serveur
 */
function updateServerIndicator(status) {
  if (!serverIndicator) {
    console.error("SERVER INDICATOR: L'indicateur de serveur n'est pas défini");
    return;
  }
  
  console.log("SERVER INDICATOR: Mise à jour avec le statut", status);
  
  try {
    if (status && status.isConnected) {
      console.log("SERVER INDICATOR: Passage au VERT");
      
      // Déboguer l'état initial
      console.log("Classes avant modification:", serverIndicator.className);
      
      // Essayer une autre approche pour s'assurer que les classes sont bien modifiées
      serverIndicator.className = "status-indicator status-connected";
      
      // Déboguer l'état final
      console.log("Classes après modification:", serverIndicator.className);
      
      serverIndicator.title = "Serveur connecté";
    } else {
      console.log("SERVER INDICATOR: Passage au ROUGE");
      
      // Déboguer l'état initial
      console.log("Classes avant modification:", serverIndicator.className);
      
      // Essayer une autre approche pour s'assurer que les classes sont bien modifiées
      serverIndicator.className = "status-indicator status-disconnected";
      
      // Déboguer l'état final
      console.log("Classes après modification:", serverIndicator.className);
      
      serverIndicator.title = "Serveur déconnecté";
    }
  } catch (error) {
    console.error("Erreur lors de la modification des classes CSS:", error);
  }
}

/**
 * Demande une mise à jour des statuts au background script
 */
function requestStatusUpdates() {
  console.log("REQUEST: Demande de mise à jour des statuts");
  
  // Demander le statut d'authentification
  chrome.runtime.sendMessage({ action: 'checkAuthentication' }, (response) => {
    console.log("REQUEST AUTH: Réponse reçue", response);
    
    if (chrome.runtime.lastError) {
      console.error('Erreur lors de la demande du statut d\'authentification:', chrome.runtime.lastError);
      return;
    }
    
    if (response && response.authenticated !== undefined) {
      // Créer un objet de statut qui correspond à ce qu'attend updateAuthIndicator
      const authStatus = { authenticated: response.authenticated };
      console.log("REQUEST AUTH: Mise à jour avec", authStatus);
      updateAuthIndicator(authStatus);
    }
  });
  
  // Demander le statut du serveur
  chrome.runtime.sendMessage({ action: 'checkServerOnline' }, (response) => {
    console.log("REQUEST SERVER: Réponse reçue", response);
    
    if (chrome.runtime.lastError) {
      console.error('Erreur lors de la demande du statut du serveur:', chrome.runtime.lastError);
      return;
    }
    
    if (response) {
      console.log("REQUEST SERVER: Mise à jour avec", response);
      updateServerIndicator(response);
    }
  });

  // Force debug update after 1 second
  setTimeout(() => {
    console.log("FORCE UPDATE: Vérification des indicateurs après 1 seconde");
    const authIndicatorElement = document.getElementById('auth-indicator');
    const serverIndicatorElement = document.getElementById('server-indicator');
    
    console.log("FORCE UPDATE: État actuel de l'indicateur d'auth:", 
                authIndicatorElement ? authIndicatorElement.className : "non trouvé");
    console.log("FORCE UPDATE: État actuel de l'indicateur de serveur:", 
                serverIndicatorElement ? serverIndicatorElement.className : "non trouvé");
  }, 1000);
}
