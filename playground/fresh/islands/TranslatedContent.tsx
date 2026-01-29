import { useEffect, useState } from "preact/hooks";
import { type Language, type Translations, getTranslations, STORAGE_KEY, DEFAULT_LANGUAGE } from "../utils/i18n.ts";

export function PageHeader() {
  const [t, setT] = useState<Translations>(getTranslations(DEFAULT_LANGUAGE));

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Language | null;
    if (saved && (saved === "en" || saved === "de")) {
      setT(getTranslations(saved));
    }
    
    const handleLangChange = (e: Event) => {
      const newLang = (e as CustomEvent).detail as Language;
      setT(getTranslations(newLang));
    };
    
    globalThis.addEventListener("languagechange", handleLangChange);
    return () => globalThis.removeEventListener("languagechange", handleLangChange);
  }, []);

  return (
    <div class="mb-4 sm:mb-6">
      <h1 class="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">
        {t.headings.title}
      </h1>
      <p class="text-sm sm:text-base text-slate-600 dark:text-slate-400">
        {t.headings.subtitle.split("fhirpath-atollee")[0]}
        <a 
          href="https://github.com/atollee/fhirpath-atollee" 
          class="link-atollee hover:underline font-medium"
        >
          fhirpath-atollee
        </a>
        {t.headings.subtitle.split("fhirpath-atollee")[1]}
      </p>
    </div>
  );
}

export function FeatureCards() {
  const [t, setT] = useState<Translations>(getTranslations(DEFAULT_LANGUAGE));

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Language | null;
    if (saved && (saved === "en" || saved === "de")) {
      setT(getTranslations(saved));
    }
    
    const handleLangChange = (e: Event) => {
      const newLang = (e as CustomEvent).detail as Language;
      setT(getTranslations(newLang));
    };
    
    globalThis.addEventListener("languagechange", handleLangChange);
    return () => globalThis.removeEventListener("languagechange", handleLangChange);
  }, []);

  return (
    <div class="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      <div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4">
        <h3 class="font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
          <span class="text-atollee-ocean">🚀</span> {t.features.performance.title}
        </h3>
        <p class="text-sm text-slate-600 dark:text-slate-400">
          {t.features.performance.description}
        </p>
      </div>
      <div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4">
        <h3 class="font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
          <span class="text-atollee-orange">💡</span> {t.features.optimization.title}
        </h3>
        <p class="text-sm text-slate-600 dark:text-slate-400">
          {t.features.optimization.description}
        </p>
      </div>
      <div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:col-span-2 lg:col-span-1">
        <h3 class="font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
          <span class="text-atollee-sea">📋</span> {t.features.history.title}
        </h3>
        <p class="text-sm text-slate-600 dark:text-slate-400">
          {t.features.history.description}
        </p>
      </div>
    </div>
  );
}

export function Footer() {
  const [t, setT] = useState<Translations>(getTranslations(DEFAULT_LANGUAGE));

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Language | null;
    if (saved && (saved === "en" || saved === "de")) {
      setT(getTranslations(saved));
    }
    
    const handleLangChange = (e: Event) => {
      const newLang = (e as CustomEvent).detail as Language;
      setT(getTranslations(newLang));
    };
    
    globalThis.addEventListener("languagechange", handleLangChange);
    return () => globalThis.removeEventListener("languagechange", handleLangChange);
  }, []);

  return (
    <p class="text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400">
      {t.footer}
      {" • "}
      <a href="https://atollee.com" class="link-atollee hover:underline">atollee</a>
    </p>
  );
}
