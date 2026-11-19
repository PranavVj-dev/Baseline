import { createRoot } from 'react-dom/client';
import { AuthProvider } from '@baseline/ui';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <AuthProvider tokenKey="baseline-token">
    <App />
  </AuthProvider>
);

// Lets the app be installed to the home screen and open when the connection is poor.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
