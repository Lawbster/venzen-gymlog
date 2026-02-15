import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['venzensmalllogo.png'],
      manifest: {
        name: 'Venzen Gym Log',
        short_name: 'GymLog',
        description: 'Personal workout and gym history tracker',
        theme_color: '#111f12',
        background_color: '#f2f5ef',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/venzensmalllogo.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/venzensmalllogo.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
