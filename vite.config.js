import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' lets the built site work from any path (GitHub Pages, Netlify, etc.)
export default defineConfig({ base: './', plugins: [react()] });
