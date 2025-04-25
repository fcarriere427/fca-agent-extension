// FCA-Agent - Content Script
// Script injecté dans les pages web pour interagir avec les applications professionnelles

// Fonction pour extraire le contenu de la page en fonction du domaine
function extractPageContent() {
  const url = window.location.href;
  let content = { type: 'unknown', data: {} };
  
  // Extraction pour Gmail
  if (url.includes('mail.google.com')) {
    content.type = 'gmail';
    
    // Si nous sommes dans la boîte de réception ou une autre liste d'emails
    if (document.querySelector('.AO')) {
      // Récupération des emails dans la liste (tableau principal)
      // .zA = sélecteur CSS pour les lignes d'emails dans Gmail
      const emailRows = document.querySelectorAll('tr.zA');
      content.data.emails = Array.from(emailRows).map(row => {
        // Informations de base pour chaque email dans la liste
        return {
          id: row.getAttribute('id') || '',
          read: !row.classList.contains('zE'),  // zE = classe CSS indiquant un email non lu
          sender: row.querySelector('.yW span, .zF')?.textContent?.trim() || 'Inconnu', // .yW span, .zF = sélecteurs pour le nom de l'expéditeur
          subject: row.querySelector('.y6')?.textContent?.trim() || 'Sans objet', // .y6 = sélecteur pour l'objet
          preview: row.querySelector('.y2')?.textContent?.trim() || '', // .y2 = sélecteur pour l'aperçu du contenu
          time: row.querySelector('.xW span')?.textContent?.trim() || '', // .xW span = sélecteur pour l'horodatage
          hasAttachment: row.querySelector('.brd') !== null,  // .brd = classe CSS de l'icône pièce jointe
          isStarred: row.querySelector('.T-KT:not(.aXw)') !== null // .T-KT:not(.aXw) = sélecteur pour les emails marqués d'une étoile
        };
      });
      
      // Récupération des libellés (catégories, dossiers, etc.)
      // .aim = sélecteur pour les labels/dossiers dans la barre latérale Gmail
      const labels = document.querySelectorAll('.aim');
      content.data.labels = Array.from(labels).map(label => {
        return {
          name: label.getAttribute('aria-label') || label.textContent.trim(),
          unread: label.querySelector('.bsU') ? parseInt(label.querySelector('.bsU').textContent) : 0 // .bsU = compteur d'emails non lus
        };
      });
    }
    
    // Si un email est ouvert
    // .adn = conteneur principal d'un email ouvert dans Gmail
    const openEmail = document.querySelector('.adn');
    if (openEmail) {
      const emailHeader = openEmail.querySelector('.ha'); // .ha = en-tête de l'email
      const emailBody = openEmail.querySelector('.a3s'); // .a3s = corps de l'email
      
      // Détails complets de l'email ouvert
      content.data.openEmail = {
        subject: document.querySelector('h2.hP')?.textContent?.trim() || 'Sans objet', // h2.hP = titre de l'email
        sender: {
          name: emailHeader?.querySelector('.gD')?.textContent?.trim() || 'Inconnu', // .gD = nom de l'expéditeur
          email: emailHeader?.querySelector('.go')?.textContent?.replace(/[<>]/g, '')?.trim() || '' // .go = email de l'expéditeur
        },
        recipients: Array.from(emailHeader?.querySelectorAll('.g2') || []).map(el => { // .g2 = destinataires
          return {
            name: el.textContent.trim(),
            email: el.getAttribute('email') || ''
          };
        }),
        time: emailHeader?.querySelector('.g3')?.textContent?.trim() || '', // .g3 = horodatage
        body: emailBody?.textContent?.trim() || '', // Texte brut du corps du message
        bodyHTML: emailBody?.innerHTML || '', // HTML du corps du message
        hasAttachments: document.querySelectorAll('.aQH').length > 0, // .aQH = conteneur des pièces jointes
        attachments: Array.from(document.querySelectorAll('.aQH') || []).map(att => {
          return {
            name: att.querySelector('.aV3')?.textContent?.trim() || 'Pièce jointe', // .aV3 = nom du fichier
            type: att.querySelector('.aVK')?.textContent?.trim() || '', // .aVK = type de fichier
            size: att.querySelector('.SaH2Ve')?.textContent?.trim() || '' // .SaH2Ve = taille du fichier
          };
        })
      };
    }
  }
  
  return content;
}

// Gestion des messages depuis le background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message reçu dans le content script:', message);
  
  if (message.action === 'getPageContent') {
    // Répond au background script avec le contenu extrait de la page
    const content = extractPageContent();
    sendResponse({ success: true, content });
  }
  
  return true; // Permet d'envoyer la réponse de manière asynchrone
});

// Initialisation - log pour déboggage
console.log('FCA-Agent content script chargé sur:', window.location.href);