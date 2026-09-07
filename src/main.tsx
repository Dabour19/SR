import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

/* Kill stale service workers & caches from previous versions (one-time cleanup).
   vite-plugin-pWA registers the new SW itself; this removes legacy leftovers. */
if ('serviceWorker' in navigator && window.location.search.includes('purgePwa=1')) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister());
  });
  caches?.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
