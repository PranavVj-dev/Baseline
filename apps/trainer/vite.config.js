import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Built, the Trainer app lives at /trainer/ on the same server as the Coach app. In development it stays at the root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/trainer/' : '/',
  plugins: [react()],
  resolve: { dedupe: ['react', 'react-dom'] },
  server: { port: 5174, strictPort: true, host: true, proxy: { '/api': 'http://localhost:3001' } },
}));
