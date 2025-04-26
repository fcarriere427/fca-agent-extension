// FCA-Agent - Module d'interface utilisateur
import { handleLogout } from './auth.js';
import { checkServerConnection } from '../../utils/api.js';
import { displayMessage } from './messaging.js';
import { processUserInput } from './tasks/generalTasks.js';
import { uiLog } from './ui-logger.js';

// Référence aux éléments de l'interface
let quickTaskButtons;

/**
 * Initialise les références aux éléments de l'interface
 */
export function initUI() {
  uiLog('Initialisation de l\'interface utilisateur');
  
  // Pour les boutons de tâches rapides, on les sélectionne tous
  quickTaskButtons = document.querySelectorAll('.task-btn');
  
  // Configurer l'interface utilisateur
  setupUI();
}

/**
 * Configure l'interface utilisateur et les gestionnaires d'événements
 */
export function setupUI() {
  uiLog('Configuration de l\'interface utilisateur');
  
  // Dans cette version simplifiée, nous n'avons pas de zone de saisie ni de bouton de soumission
  // donc nous ne configurons pas ces éléments
  
  // Ajouter un bouton de déconnexion dans le header
  const header = document.querySelector('header');
  const logoutBtn = document.createElement('button');
  logoutBtn.id = 'logout-btn';
  logoutBtn.title = 'Déconnexion';
  logoutBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>';
  logoutBtn.addEventListener('click', handleLogout);
  header.appendChild(logoutBtn);
  
  // Styles pour le bouton déconnexion
  const style = document.createElement('style');
  style.textContent = `
    #logout-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 5px;
      margin-left: 10px;
      color: #777;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
    }
    #logout-btn:hover {
      background-color: #f0f0f0;
      color: #d9534f;
    }
  `;
  document.head.appendChild(style);
  uiLog('Styles de l\'interface utilisateur appliqués');
  
  // Gestionnaires pour les boutons d'actions rapides
  if (quickTaskButtons && quickTaskButtons.length > 0) {
    quickTaskButtons.forEach(button => {
      button.addEventListener('click', () => {
        const taskType = button.getAttribute('data-task');
        uiLog(`Bouton d'action rapide cliqué: ${taskType}`);
        executeQuickTask(taskType);
      });
    });
    uiLog(`${quickTaskButtons.length} boutons d'actions rapides configurés`);
  } else {
    uiLog('Aucun bouton d\'action rapide trouvé', 'warn');
  }
  
  uiLog('Configuration de l\'interface utilisateur terminée');
  // La gestion des indicateurs est désormais déléguée au module status.js
}

// La fonction updateConnectionStatus a été déplacée dans le module status.js

/**
 * Exécute une action rapide en fonction du type
 * @param {string} taskType - Type de tâche à exécuter
 */
function executeQuickTask(taskType) {
  uiLog(`Exécution de la tâche rapide: ${taskType}`);
  // Importer dynamiquement le module de tâche approprié
  switch(taskType) {
    case 'gmail-summary':
      import('./tasks/gmailTasks.js')
        .then(module => module.executeGmailSummaryTask())
        .catch(error => {
          uiLog(`Erreur lors de l'exécution de la tâche ${taskType}: ${error.message}`, 'error');
          displayMessage('assistant', `Erreur: ${error.message}`);
        });
      break;
      
    default:
      uiLog(`Type de tâche inconnu: ${taskType}`, 'error');
  }
}
