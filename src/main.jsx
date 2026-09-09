import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './professional.css';
import './premium.css';
import './auth-premium.css';
import './sidebar.css';
import './app-premium.css';
import './experience-premium.css';
import './nutrition-core-3d.css';
import './nutrition-core-interactive.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
