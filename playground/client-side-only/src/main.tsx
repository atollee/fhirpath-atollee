import { render } from 'preact';
import { App } from './App';
import './styles.css';

// Initialize dark mode from system preference or localStorage
const initDarkMode = () => {
  const saved = localStorage.getItem('theme');
  if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
};

initDarkMode();
render(<App />, document.getElementById('app')!);
