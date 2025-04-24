// FCA-Agent - Module de tâches Gmail
import { displayMessage, displayLoadingMessage, removeMessage } from '../messaging.js';
import { handleTaskResponse } from './generalTasks.js';

/**
 * Exécute la tâche de synthèse des emails Gmail
 */
export function executeGmailSummaryTask() {
  // Vérifier si nous sommes sur Gmail
  chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
    // Récupérer l'URL de l'onglet actif
    const activeTabUrl = tabs[0]?.url || '';
    const activeTabId = tabs[0]?.id;
    
    if (!activeTabUrl.includes('mail.google.com')) {
      // Si nous ne sommes pas sur Gmail, demander à l'utilisateur d'y aller
      displayMessage('assistant', 'Pour utiliser cette fonctionnalité, veuillez ouvrir Gmail dans votre navigateur.');
      return;
    }
    
    // Demander à l'utilisateur un sujet de recherche optionnel
    const searchQuery = prompt('Entrez un sujet spécifique pour cibler la synthèse (laissez vide pour une synthèse générale) :', '');
    const taskTitle = searchQuery ? `Synthèse des emails Gmail sur "${searchQuery}"` : 'Synthèse des emails Gmail';
    
    // Afficher un message indiquant que nous extrayons les emails
    displayMessage('user', taskTitle);
    const loadingMsgId = displayLoadingMessage('Extraction des emails en cours...');
    
    // Extraire les emails de Gmail
    try {
      await extractGmailData(activeTabId, searchQuery, loadingMsgId);
    } catch (error) {
      removeMessage(loadingMsgId);
      displayMessage('assistant', `Erreur lors de l'extraction des emails : ${error.message}`);
    }
  });
}

/**
 * Extrait les données de Gmail via l'API scripting
 * @param {number} tabId - ID de l'onglet actif 
 * @param {string} searchQuery - Requête de recherche (optionnelle)
 * @param {string} loadingMsgId - ID du message de chargement
 */
async function extractGmailData(tabId, searchQuery, loadingMsgId) {
  // Injecter et exécuter le code d'extraction directement dans la page Gmail
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: function() {
      // Code d'extraction autonome pour Gmail
      const url = window.location.href;
      let content = { type: 'gmail', data: {} };
      
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
          time: emailHeader?.querySelector('.g3')?.textContent?.trim() || '',
          body: emailBody?.textContent?.trim() || ''
        };
      }
      
      return content;
    }
  }, (injectionResults) => {
    if (chrome.runtime.lastError) {
      removeMessage(loadingMsgId);
      displayMessage('assistant', 'Erreur lors de l\'extraction des emails : ' + chrome.runtime.lastError.message);
      return;
    }
    
    if (!injectionResults || injectionResults.length === 0) {
      removeMessage(loadingMsgId);
      displayMessage('assistant', 'Aucun résultat d\'extraction obtenu.');
      return;
    }
    
    const content = injectionResults[0].result;
    
    // Vérifier si nous avons extrait des emails
    if (!content || (!content.data?.emails && !content.data?.openEmail)) {
      removeMessage(loadingMsgId);
      displayMessage('assistant', 'Aucun email à analyser. Veuillez ouvrir votre boîte de réception Gmail ou un email spécifique.');
      return;
    }
    
    // Mettre à jour le message de chargement
    removeMessage(loadingMsgId);
    const processingMsgId = displayLoadingMessage('Analyse des emails en cours avec Claude...');
    
    // Préparer les données
    const emails = content.data.emails || (content.data.openEmail ? [content.data.openEmail] : []);
    
    // Envoyer les données extraites au serveur pour traitement par Claude
    console.log('Envoi des données pour analyse :', {
      emails: emails.length,
      searchQuery: searchQuery
    });
    
    chrome.runtime.sendMessage(
      {
        action: 'executeTask',
        task: 'gmail-summary',
        data: {
          emails: emails,
          searchQuery: searchQuery
        }
      },
      response => {
        removeMessage(processingMsgId);
        console.log('Réponse reçue du serveur :', response);
        handleTaskResponse(response, processingMsgId);
      }
    );
  });
}
