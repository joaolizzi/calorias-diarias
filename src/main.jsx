import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './professional.css';
import './premium.css';
import './auth-premium.css';
import './sidebar.css';
import './app-premium.css';
import './dashboard-v3.css';
import './brand-system.css';
import './product-polish.css';
import './visual-fixes.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
