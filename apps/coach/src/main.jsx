import { createRoot } from 'react-dom/client';
import { AuthProvider } from '@baseline/ui';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <AuthProvider tokenKey="baseline-coach-token">
    <App />
  </AuthProvider>
);
