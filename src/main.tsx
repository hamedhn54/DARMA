import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// ثبت سرویس‌ورکر برای قابلیت PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('DARMA PWA: Service Worker registered successfully.', registration);
      })
      .catch(error => {
        console.log('DARMA PWA: Service Worker registration failed.', error);
      });
  });
}