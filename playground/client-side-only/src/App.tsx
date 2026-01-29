import { useState, useEffect } from 'preact/hooks';
import { PlaygroundIsland } from './components/PlaygroundIsland';
import { type Language, getTranslations, STORAGE_KEY as LANG_STORAGE_KEY, DEFAULT_LANGUAGE } from './utils/i18n';

export function App() {
  const [isDark, setIsDark] = useState(false);
  const [lang, setLang] = useState<Language>(DEFAULT_LANGUAGE);
  const t = getTranslations(lang);

  // Initialize dark mode
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  // Initialize language
  useEffect(() => {
    const saved = localStorage.getItem(LANG_STORAGE_KEY) as Language | null;
    if (saved && (saved === 'en' || saved === 'de')) {
      setLang(saved);
    }
  }, []);

  const toggleDark = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    document.documentElement.classList.toggle('dark', newDark);
    localStorage.setItem('theme', newDark ? 'dark' : 'light');
  };

  const toggleLang = () => {
    const newLang = lang === 'en' ? 'de' : 'en';
    setLang(newLang);
    localStorage.setItem(LANG_STORAGE_KEY, newLang);
  };

  return (
    <div class="min-h-screen bg-slate-100 dark:bg-slate-900">
      {/* Header */}
      <header class="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div class="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div class="flex items-center justify-between h-14 sm:h-16">
            <div class="flex items-center gap-2 sm:gap-3">
              <span class="text-xl sm:text-2xl font-bold text-atollee-ocean">⚡</span>
              <span class="text-base sm:text-lg font-semibold text-slate-800 dark:text-white">
                {t.nav.playground}
              </span>
            </div>
            
            <nav class="flex items-center gap-2 sm:gap-4 text-sm">
              <a
                href="https://github.com/atollee/fhirpath-atollee"
                target="_blank"
                rel="noopener noreferrer"
                class="link-atollee hidden sm:inline"
              >
                {t.nav.github}
              </a>
              <a
                href="https://hl7.org/fhirpath/"
                target="_blank"
                rel="noopener noreferrer"
                class="link-atollee hidden sm:inline"
              >
                {t.nav.spec}
              </a>
              <button
                onClick={toggleLang}
                class="px-2 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                {lang === 'en' ? 'DE' : 'EN'}
              </button>
              <button
                onClick={toggleDark}
                class="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                title={t.nav.toggleDark}
              >
                {isDark ? '☀️' : '🌙'}
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main class="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div class="mb-4 sm:mb-6">
          <h1 class="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white mb-1 sm:mb-2">
            {t.headings.title}
          </h1>
          <p class="text-sm sm:text-base text-slate-600 dark:text-slate-400">
            {t.headings.subtitle.split('fhirpath-atollee')[0]}
            <a 
              href="https://github.com/atollee/fhirpath-atollee" 
              class="link-atollee hover:underline font-medium"
            >
              fhirpath-atollee
            </a>
            {t.headings.subtitle.split('fhirpath-atollee')[1]}
          </p>
        </div>

        <PlaygroundIsland isDark={isDark} lang={lang} />

        {/* Features */}
        <div class="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4">
            <h3 class="font-semibold text-slate-800 dark:text-white mb-1">🚀 {t.features.performance.title}</h3>
            <p class="text-sm text-slate-600 dark:text-slate-400">{t.features.performance.description}</p>
          </div>
          <div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4">
            <h3 class="font-semibold text-slate-800 dark:text-white mb-1">💡 {t.features.optimization.title}</h3>
            <p class="text-sm text-slate-600 dark:text-slate-400">{t.features.optimization.description}</p>
          </div>
          <div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:col-span-2 lg:col-span-1">
            <h3 class="font-semibold text-slate-800 dark:text-white mb-1">📋 {t.features.history.title}</h3>
            <p class="text-sm text-slate-600 dark:text-slate-400">{t.features.history.description}</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer class="mt-8 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
        {t.footer}
      </footer>
    </div>
  );
}
