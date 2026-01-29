import { useEffect, useState } from "preact/hooks";
import { type Language, STORAGE_KEY, DEFAULT_LANGUAGE } from "../utils/i18n.ts";

export default function LanguageSwitcher() {
  const [lang, setLang] = useState<Language>(DEFAULT_LANGUAGE);

  useEffect(() => {
    // Load saved language
    const saved = localStorage.getItem(STORAGE_KEY) as Language | null;
    if (saved && (saved === "en" || saved === "de")) {
      setLang(saved);
      document.documentElement.setAttribute("lang", saved);
    }
  }, []);

  const toggleLanguage = () => {
    const newLang: Language = lang === "en" ? "de" : "en";
    setLang(newLang);
    localStorage.setItem(STORAGE_KEY, newLang);
    document.documentElement.setAttribute("lang", newLang);
    // Dispatch custom event for other components to react
    globalThis.dispatchEvent(new CustomEvent("languagechange", { detail: newLang }));
  };

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      class="px-2 py-1 text-xs font-medium rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
      aria-label={lang === "en" ? "Switch to German" : "Auf Englisch wechseln"}
      title={lang === "en" ? "Deutsch" : "English"}
    >
      {lang === "en" ? "DE" : "EN"}
    </button>
  );
}
