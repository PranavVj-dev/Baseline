import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// Visible press feedback on every button, even for very quick taps.
document.addEventListener('pointerdown', (e) => {
  const b = e.target.closest && e.target.closest('button');
  if (!b || b.disabled) return;
  b.classList.remove('tap');
  void b.offsetWidth; // restart the animation
  b.classList.add('tap');
  b.addEventListener('animationend', () => b.classList.remove('tap'), { once: true });
});

createRoot(document.getElementById('root')).render(<App />);
