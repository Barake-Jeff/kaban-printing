export default defineNuxtConfig({
  devtools: { enabled: true },

  runtimeConfig: {
    public: {
      apiBase: 'http://localhost:3001/api',
      vapidKey: '',  // overridden by NUXT_PUBLIC_VAPID_KEY env var
    },
  },

  modules: ['@pinia/nuxt', '@nuxtjs/tailwindcss', '@vite-pwa/nuxt'],

  tailwindcss: {
    cssPath: '~/assets/main.css',
  },

  imports: {
    dirs: ['stores'],
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'PrintEase',
      short_name: 'PrintEase',
      description: 'Your neighbourhood print shop, now online',
      theme_color: '#1B2D5B',
      background_color: '#F9F9F7',
      display: 'standalone',
      orientation: 'portrait',
      start_url: '/app',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
      importScripts: ['/sw-push.js'],
    },
    client: {
      installPrompt: true,
    },
    devOptions: {
      enabled: false,
    },
  },

  app: {
    head: {
      title: 'PrintEase',
      meta: [
        { charset: 'UTF-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1.0' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;600;700;800&display=swap' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600;700;800&display=swap' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap' },
      ],
    },
  },
})
