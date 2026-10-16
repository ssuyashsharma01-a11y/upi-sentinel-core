import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Self-hosted fonts: 100% Zero Network Leakage
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource/jetbrains-mono';
import '@fontsource-variable/noto-sans-devanagari';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
