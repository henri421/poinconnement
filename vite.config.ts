import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  root: 'app',
  // Chemins relatifs : la page est servie depuis un sous-chemin sur GitHub
  // Pages (/poinconnement/), pas depuis la racine d'un domaine.
  base: './',
  build: {
    outDir: '../docs',
    emptyOutDir: false,
  },
  plugins: [
    VitePWA({
      // Enregistrement explicite dans main.ts : `injectRegister: null` evite
      // un second enregistrement du service worker par le plugin.
      injectRegister: null,
      // Une nouvelle version attend l'accord de l'utilisateur : un calcul en
      // cours ne doit pas etre recharge sous ses yeux.
      registerType: 'prompt',
      includeAssets: ['icone.svg'],
      manifest: {
        // Identifiant, depart et portee RELATIFS : le site vit dans un
        // sous-chemin de GitHub Pages.
        id: './',
        start_url: './',
        scope: './',
        name: 'poinconnement — dalles, EN 1992-1-1 §6.4',
        short_name: 'Poinconnement',
        description: "Verification du poinconnement des dalles pleines selon l'EN 1992-1-1 §6.4.",
        lang: 'fr',
        display: 'standalone',
        background_color: '#f7f7f6',
        theme_color: '#f7f7f6',
        icons: [
          { src: 'icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icone-masquable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        navigateFallback: 'index.html',
        // Application entierement locale : rien a mettre en cache au vol.
        // La limite de precache par defaut (2 Mio) est conservee : la relever
        // masquerait une derive de taille du bundle.
        runtimeCaching: [],
      },
      // Pour tester l'installation en `npm run dev`.
      devOptions: { enabled: true },
    }),
  ],
  // Vitest reutilise ce fichier : sans ce champ, le `root: 'app'` ci-dessus
  // s'appliquerait aussi aux tests, qui vivent hors de `app/`.
  test: {
    root: '.',
    exclude: ['**/node_modules/**', '**/dist/**', '.worktrees/**'],
  },
});
