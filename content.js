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
  
  // Extraction pour Gmail
  else if (url.includes('mail.google.com')) {
    content.type = 'gmail';
    
    // Si nous sommes dans la boîte de réception ou une autre liste d'emails
    if (document.querySelector('.AO')) {
      // Récupération des emails dans la liste (tableau principal)
      const emailRows = document.querySelectorAll('tr.zA');
      content.data.emails = Array.from(emailRows).map(row => {
        // Informations de base pour chaque email dans la liste
        return {
          id: row.getAttribute('id') || '',
          read: !row.classList.contains('zE'),  // zE = non lu
          sender: row.querySelector('.yW span, .zF')?.textContent?.trim() || 'Inconnu',
          subject: row.querySelector('.y6')?.textContent?.trim() || 'Sans objet',
          preview: row.querySelector('.y2')?.textContent?.trim() || '',
          time: row.querySelector('.xW span')?.textContent?.trim() || '',
          hasAttachment: row.querySelector('.brd') !== null,  // .brd = icône pièce jointe
          isStarred: row.querySelector('.T-KT:not(.aXw)') !== null
        };
      });
      
      // Récupération des libellés (catégories, dossiers, etc.)
      const labels = document.querySelectorAll('.aim');
      content.data.labels = Array.from(labels).map(label => {
        return {
          name: label.getAttribute('aria-label') || label.textContent.trim(),
          unread: label.querySelector('.bsU') ? parseInt(label.querySelector('.bsU').textContent) : 0
        };
      });
    }
    
    // Si un email est ouvert
    const openEmail = document.querySelector('.adn');
    if (openEmail) {
      const emailHeader = openEmail.querySelector('.ha');
      const emailBody = openEmail.querySelector('.a3s');
      
      // Détails complets de l'email ouvert
      content.data.openEmail = {
        subject: document.querySelector('h2.hP')?.textContent?.trim() || 'Sans objet',
        sender: {
          name: emailHeader?.querySelector('.gD')?.textContent?.trim() || 'Inconnu',
          email: emailHeader?.querySelector('.go')?.textContent?.replace(/[<>]/g, '')?.trim() || ''
        },
        recipients: Array.from(emailHeader?.querySelectorAll('.g2') || []).map(el => {
          return {
            name: el.textContent.trim(),
            email: el.getAttribute('email') || ''
          };
        }),
        time: emailHeader?.querySelector('.g3')?.textContent?.trim() || '',
        body: emailBody?.textContent?.trim() || '',
        bodyHTML: emailBody?.innerHTML || '',
        hasAttachments: document.querySelectorAll('.aQH').length > 0,
        attachments: Array.from(document.querySelectorAll('.aQH') || []).map(att => {
          return {
            name: att.querySelector('.aV3')?.textContent?.trim() || 'Pièce jointe',
            type: att.querySelector('.aVK')?.textContent?.trim() || '',
            size: att.querySelector('.SaH2Ve')?.textContent?.trim() || ''
          };
        })
      };
    }
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