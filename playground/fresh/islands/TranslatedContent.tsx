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
