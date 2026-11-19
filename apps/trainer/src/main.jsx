import { createRoot } from 'react-dom/client';
import { AuthProvider } from '@baseline/ui';
import App from './App.jsx';

// One sign-in for both apps: they share an address when online, so they share this key.
createRoot(document.getElementById('root')).render(
  <AuthProvider tokenKey="baseline-token">
    <App />
  </AuthProvider>
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/trainer/sw.js', { scope: '/trainer/' }).catch(() => {}));
}
