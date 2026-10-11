import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // relative asset URLs: the same build works at a domain root or under a sub-path
  // (GitHub Pages serves it at /<repo>/); lessons are addressed by URL hash
  base: './',
  worker: { format: 'es' },
  build: { chunkSizeWarningLimit: 2500 },
});
