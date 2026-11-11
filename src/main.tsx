import { render } from 'preact';
import { App } from './app.js';
import './styles/tokens.css';
import './styles/base.css';
import './styles/komponen.css';

// PWA Service Worker Registration
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true });
  });
}

const root = document.getElementById('app');
if (root) {
  render(<App />, root);
}

