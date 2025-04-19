// FCA-Agent - Content Script
// Script injecté dans les pages web pour interagir avec les applications professionnelles

// Fonction pour extraire le contenu de la page en fonction du domaine
function extractPageContent() {
  const url = window.location.href;
  let content = { type: 'unknown', data: {} };
  
  // Extraction pour Microsoft Outlook
  if (url.includes('outlook.office.com')) {
    content.type = 'outlook';
    
    // Extraction des emails (exemple simplifié - à adapter selon la structure réelle)
    if (url.includes('/mail/')) {
      const emailElements = document.querySelectorAll('[role="listitem"]');
      content.data.emails = Array.from(emailElements).map(el => {
        return {
          sender: el.querySelector('[title]')?.getAttribute('title') || 'Inconnu',
          subject: el.querySelector('[data-automation-id="sub-title"]')?.textContent || 'Sans objet',
          preview: el.querySelector('[data-automation-id="text-preview"]')?.textContent || '',
          time: el.querySelector('time')?.textContent || ''
        };
      });
      
      // Si un email est ouvert, on extrait son contenu
      const openEmail = document.querySelector('[role="main"]');
      if (openEmail) {
        content.data.openEmail = {
          subject: document.querySelector('[data-automation-id="rp-sub-title"]')?.textContent || '',
          body: document.querySelector('[role="region"][aria-label]')?.textContent || ''
        };
      }
    }
  }
  
  // Extraction pour Microsoft Teams
  else if (url.includes('teams.microsoft.com')) {
    content.type = 'teams';
    // Exemple simplifié - à adapter
    const messages = document.querySelectorAll('[data-tid="message"]');
    content.data.messages = Array.from(messages).map(msg => {
      return {
        sender: msg.querySelector('[data-tid="userName"]')?.textContent || 'Inconnu',
        time: msg.querySelector('[data-tid="messageTimeStamp"]')?.textContent || '',
        content: msg.querySelector('[data-tid="messageContent"]')?.textContent || ''
      };
    });
  }
  
  // Extraction pour SharePoint
  else if (url.includes('sharepoint.com')) {
    content.type = 'sharepoint';
    // À implémenter selon les besoins
  }
  
  // Extraction pour Trello
  else if (url.includes('trello.com')) {
    content.type = 'trello';
    // À implémenter selon les besoins
  }
  
  return content;
}

// Fonction pour capturer une capture d'écran de la page
function captureScreenshot() {
  // Note: La capture d'écran nécessite l'utilisation de chrome.tabs API depuis le background script
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'captureScreenshot' }, response => {
      resolve(response);
    });
  });
}

// Gestion des messages depuis le background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message reçu dans le content script:', message);
  
  if (message.action === 'getPageContent') {
    const content = extractPageContent();
    sendResponse({ success: true, content });
  }
  
  else if (message.action === 'fillForm') {
    // Fonction à développer pour remplir des formulaires
    const success = fillFormFields(message.data);
    sendResponse({ success });
  }
  
  return true; // Permet d'envoyer la réponse de manière asynchrone
});

// Fonction pour remplir un formulaire (à développer en fonction des besoins)
function fillFormFields(formData) {
  try {
    // Exemple simplifié
    for (const [selector, value] of Object.entries(formData)) {
      const element = document.querySelector(selector);
      if (element) {
        element.value = value;
        // Déclencher un événement pour simuler la saisie utilisateur
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    return true;
  } catch (error) {
    console.error('Erreur lors du remplissage du formulaire:', error);
    return false;
  }
}

// Initialisation
console.log('FCA-Agent content script chargé sur:', window.location.href);