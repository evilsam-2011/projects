import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'Calander',
        short_name: 'Calander',
        description: 'Productivity dashboard with kanban, calendar, pomodoro, habits & more',
        theme_color: '#0b0b0f',
        background_color: '#0b0b0f',
        display: 'standalone',
        icons: [
          { src: 'icons.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        runtimeCaching: [],
      },
    }),
  ],
})
