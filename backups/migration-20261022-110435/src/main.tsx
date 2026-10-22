/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 */
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Safeguard against benign environment websocket disconnects
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const errText = String(event?.reason?.message || event?.reason || '');
    if (
      errText.includes('WebSocket closed without opened') ||
      errText.includes('[vite] failed to connect') ||
      errText.includes('failed to connect to websocket')
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

