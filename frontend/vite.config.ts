import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // The frontend calls same-origin `/api/*` and Vite forwards it to the API.
    // Keeps the browser free of CORS preflights in development; in production
    // the same paths are served by a reverse proxy (or VITE_API_BASE_URL).
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
