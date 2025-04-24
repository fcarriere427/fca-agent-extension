// FCA-Agent - Point d'entrée principal
import { checkAuthOnce } from './auth.js';
import { initUI, setupUI } from './ui.js';
import { initMessaging } from './messaging.js';

// Initialisation de l'application au chargement du DOM
document.addEventListener('DOMContentLoaded', () => {
  // Récupérer les éléments DOM principaux
  const userInput = document.getElementById('user-input');
  const submitBtn = document.getElementById('submit-btn');
  const responseArea = document.getElementById('response-area');
  const statusIndicator = document.getElementById('status-indicator');
  const quickTaskButtons = document.querySelectorAll('.task-btn');
  
  // Initialiser le module de messagerie
  initMessaging(responseArea);
  
  // Initialiser l'interface utilisateur
  initUI({
    userInput,
    submitBtn,
    statusIndicator,
    quickTaskButtons
  });
  
  // Vérifier si l'utilisateur est authentifié avant tout
  checkAuthOnce(() => {
    // Configurer l'interface après vérification d'authentification
    setupUI();
  });
});
