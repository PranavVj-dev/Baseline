import './tokens.css';

// Every button in both apps gets the same visible press feedback, even on very quick taps.
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest && e.target.closest('button');
    if (!b || b.disabled) return;
    b.classList.remove('tap');
    void b.offsetWidth;
    b.classList.add('tap');
    b.addEventListener('animationend', () => b.classList.remove('tap'), { once: true });
  });
}

export { AuthProvider, useAuth } from './auth.jsx';
export { default as AuthScreen } from './AuthScreen.jsx';
export { default as AppShell } from './AppShell.jsx';
export { useLoad } from './useLoad.js';
