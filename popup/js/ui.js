// FCA-Agent - Module d'interface utilisateur
import { handleLogout } from './auth.js';
import { checkServerConnection } from '../../utils/api.js';
import { displayMessage } from './messaging.js';
import { processUserInput } from './tasks/generalTasks.js';

// Référence aux éléments de l'interface
let userInput;
let submitBtn;
let statusIndicator;
let quickTaskButtons;

/**
 * Initialise les références aux éléments de l'interface
 * @param {Object} elements - Éléments DOM à initialiser
 */
export function initUI(elements) {
  userInput = elements.userInput;
  submitBtn = elements.submitBtn;
  statusIndicator = elements.statusIndicator;
  quickTaskButtons = elements.quickTaskButtons;
}

/**
 * Configure l'interface utilisateur et les gestionnaires d'événements
 */
export function setupUI() {
  // Gestionnaire pour soumettre l'entrée utilisateur
  submitBtn.addEventListener('click', () => {
    processUserInput(userInput.value.trim());
    userInput.value = '';
  });
  
  // Gestionnaire pour soumettre avec Entrée
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      processUserInput(userInput.value.trim());
      userInput.value = '';
    }
  });
  
  // Ajouter un bouton de déconnexion dans le header
  const header = document.querySelector('header');
  const logoutBtn = document.createElement('button');
  logoutBtn.id = 'logout-btn';
  logoutBtn.title = 'Déconnexion';
  logoutBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>';
  logoutBtn.addEventListener('click', handleLogout);
  header.appendChild(logoutBtn);
  
  // Style pour le bouton déconnexion
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
  
  // Gestionnaires pour les boutons d'actions rapides
  quickTaskButtons.forEach(button => {
    button.addEventListener('click', () => {
      const taskType = button.getAttribute('data-task');
      executeQuickTask(taskType);
    });
  });
  
  // Mise à jour du statut de connexion
  updateConnectionStatus();
}

/**
 * Met à jour l'indicateur de statut de connexion
 */
export async function updateConnectionStatus() {
  const isConnected = await checkServerConnection();
  
  if (isConnected) {
    statusIndicator.classList.remove('status-disconnected');
    statusIndicator.classList.add('status-connected');
    statusIndicator.title = 'Connecté au serveur';
  } else {
    statusIndicator.classList.remove('status-connected');
    statusIndicator.classList.add('status-disconnected');
    statusIndicator.title = 'Déconnecté du serveur';
  }
}

/**
 * Exécute une action rapide en fonction du type
 * @param {string} taskType - Type de tâche à exécuter
 */
function executeQuickTask(taskType) {
  // Importer dynamiquement le module de tâche approprié
  switch(taskType) {
    case 'gmail-summary':
      import('./tasks/gmailTasks.js')
        .then(module => module.executeGmailSummaryTask())
        .catch(error => displayMessage('assistant', `Erreur: ${error.message}`));
      break;
      
    default:
      console.error(`Type de tâche inconnu: ${taskType}`);
  }
}
