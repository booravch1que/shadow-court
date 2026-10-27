import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AppProvider } from './hooks';
import { startApp } from './net/socket';
import { playCue } from './sound';
import './styles/app.css';

const app = startApp({
  onCue: playCue,
  // Keep the address bar a shareable invite link while in a room.
  onUrlChange: (code) => {
    try {
      history.replaceState(null, '', code ? `/?join=${code}` : '/');
    } catch {
      // not critical
    }
  },
});

const container = document.getElementById('root');
if (!container) throw new Error('#root is missing');
createRoot(container).render(
  <StrictMode>
    <AppProvider app={app}>
      <App />
    </AppProvider>
  </StrictMode>,
);
