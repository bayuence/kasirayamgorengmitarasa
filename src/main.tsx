import { render } from 'preact';
import { App } from './app.js';
import './styles/tokens.css';
import './styles/base.css';
import './styles/komponen.css';

// PWA Service Worker Registration dengan Auto-Update Instan
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    const updateSW = registerSW({
      immediate: true,
      onRegisteredSW(_swUrl, r) {
        // Cek update berkala setiap 60 detik jika aplikasi sedang dibuka
        if (r) {
          setInterval(() => {
            r.update().catch(() => {});
          }, 60 * 1000);
        }
      },
      onNeedRefresh() {
        // Otomatis update PWA ke versi terbaru tanpa perlu manual reload
        updateSW(true);
      },
    });
  });
}

const root = document.getElementById('app');
if (root) {
  render(<App />, root);
}

