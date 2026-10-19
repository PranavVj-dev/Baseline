import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// /api calls are forwarded to the Baseline server, so phones on your Wi-Fi only need this one address.
export default defineConfig({
  plugins: [react()],
  resolve: { dedupe: ['react', 'react-dom'] },
  server: { port: 5173, strictPort: true, host: true, proxy: { '/api': 'http://localhost:3001' } },
});
