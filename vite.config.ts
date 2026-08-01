import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const productionBase = '/80kg-sprint/'

export default defineConfig(({ command }) => {
  const base = command === 'serve' ? '/' : productionBase

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: null,
        manifest: {
          id: base,
          name: '80KG Sprint',
          short_name: '80KG Sprint',
          description: '7 天減重計畫與健康紀錄，只儲存在你的裝置。',
          lang: 'zh-TW',
          start_url: base,
          scope: base,
          display: 'standalone',
          orientation: 'portrait-primary',
          theme_color: '#0a0d0c',
          background_color: '#0a0d0c',
          icons: [
            { src: `${base}pwa-192x192.png`, sizes: '192x192', type: 'image/png' },
            { src: `${base}pwa-512x512.png`, sizes: '512x512', type: 'image/png' },
            { src: `${base}maskable-512x512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' }
          ]
        },
        workbox: {
          cacheId: '80kg-sprint',
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          navigateFallback: 'index.html',
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}']
        },
        devOptions: {
          enabled: true,
          type: 'module'
        }
      })
    ],
    test: {
      environment: 'node'
    }
  }
})
