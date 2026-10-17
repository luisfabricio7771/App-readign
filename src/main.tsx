import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles.css';
import './reader-features.css';
import { isDesktopApp } from './platform';

// Desktop ships all assets and must read the installed version immediately.
if (!isDesktopApp) registerSW({ onOfflineReady() { window.dispatchEvent(new Event('offline-ready')); } });
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
