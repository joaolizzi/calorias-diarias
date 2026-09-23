import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './professional.css';
import './premium.css';
import './auth-premium.css';
import './sidebar.css';
import './app-premium.css';
import './brand-system.css';
import './visual-fixes.css';
import './premium-themes.css';
import './product-polish.css';
import './layout-contract.css';
import './color-system.css';
import './brand-accent.css';
import './appearance-runtime-fix.css';
import './macro-system.css';
import './history-charts.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
