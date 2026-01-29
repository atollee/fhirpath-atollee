/**
 * Internationalization (i18n) for FHIRPath Playground
 * Supports: English (en), German (de)
 * Default: English
 */

export type Language = "en" | "de";

export const STORAGE_KEY = "fhirpath-playground-lang";
export const DEFAULT_LANGUAGE: Language = "en";

export interface Translations {
  // Navigation
  nav: {
    playground: string;
    github: string;
    spec: string;
    toggleDark: string;
  };
  // Main headings
  headings: {
    title: string;
    subtitle: string;
    resource: string;
    expression: string;
  };
  // Features
  features: {
    performance: {
      title: string;
      description: string;
    };
    optimization: {
      title: string;
      description: string;
    };
    history: {
      title: string;
      description: string;
    };
  };
  // Playground
  playground: {
    favorite: string;
    removeFavorite: string;
    copy: string;
    copied: string;
    history: string;
    favorites: string;
    result: string;
    ast: string;
    hints: string;
    placeholder: string;
    loading: string;
    evaluating: string;
    empty: string;
    noHints: string;
    complexity: string;
    jit: string;
    noJit: string;
    fhirRelease: string;
    fhirReleaseTooltip: string;
  };
  // Sample expressions
  samples: {
    givenNames: string;
    officialName: string;
    isActive: string;
    countNames: string;
    hasPhone: string;
    identifiers: string;
    typeCheck: string;
  };
  // Footer
  footer: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    nav: {
      playground: "FHIRPath Playground",
      github: "GitHub",
      spec: "FHIRPath Spec",
      toggleDark: "Toggle dark mode",
    },
    headings: {
      title: "FHIRPath Playground",
      subtitle: "Interactive FHIRPath expression tester with live evaluation, AST visualization, optimization hints, and JIT compiler support. Powered by fhirpath-atollee — up to 75x faster than fhirpath.js.",
      resource: "Resource (JSON)",
      expression: "Expression",
    },
    features: {
      performance: {
        title: "High Performance",
        description: "JIT compiler delivers 50-75x faster execution than fhirpath.js. Native TypeScript parser with zero external dependencies.",
      },
      optimization: {
        title: "Smart Optimization",
        description: "Real-time hints suggest improvements like using exists() instead of count() > 0. Complexity scoring helps identify expensive expressions.",
      },
      history: {
        title: "History & Favorites",
        description: "Copy expressions to clipboard. History and favorites persist locally. Perfect for documentation and debugging.",
      },
    },
    playground: {
      favorite: "Add to favorites",
      removeFavorite: "Remove from favorites",
      copy: "Copy expression",
      copied: "Copied!",
      history: "History",
      favorites: "Favorites",
      result: "Result",
      ast: "AST",
      hints: "Hints",
      placeholder: "Enter FHIRPath expression...",
      loading: "Loading editor...",
      evaluating: "Evaluating...",
      empty: "(empty)",
      noHints: "No optimization suggestions",
      complexity: "Complexity",
      jit: "JIT",
      noJit: "No JIT",
      fhirRelease: "FHIR",
      fhirReleaseTooltip: "FHIR version for type checking (is/as/ofType)",
    },
    samples: {
      givenNames: "Given names",
      officialName: "Official name",
      isActive: "Is active",
      countNames: "Count names",
      hasPhone: "Has phone",
      identifiers: "Identifiers",
      typeCheck: "Type check",
    },
    footer: "fhirpath-atollee - High-performance FHIRPath for TypeScript",
  },
  de: {
    nav: {
      playground: "FHIRPath Playground",
      github: "GitHub",
      spec: "FHIRPath Spez.",
      toggleDark: "Dunkelmodus umschalten",
    },
    headings: {
      title: "FHIRPath Playground",
      subtitle: "Interaktiver FHIRPath-Ausdruckstester mit Live-Auswertung, AST-Visualisierung, Optimierungshinweisen und JIT-Compiler-Unterstützung. Powered by fhirpath-atollee — bis zu 75x schneller als fhirpath.js.",
      resource: "Ressource (JSON)",
      expression: "Ausdruck",
    },
    features: {
      performance: {
        title: "Hohe Leistung",
        description: "JIT-Compiler liefert 50-75x schnellere Ausführung als fhirpath.js. Nativer TypeScript-Parser ohne externe Abhängigkeiten.",
      },
      optimization: {
        title: "Intelligente Optimierung",
        description: "Echtzeit-Hinweise schlagen Verbesserungen vor, z.B. exists() statt count() > 0. Komplexitätsbewertung hilft, teure Ausdrücke zu identifizieren.",
      },
      history: {
        title: "Verlauf & Favoriten",
        description: "Ausdrücke in die Zwischenablage kopieren. Verlauf und Favoriten werden lokal gespeichert. Perfekt für Dokumentation und Debugging.",
      },
    },
    playground: {
      favorite: "Zu Favoriten hinzufügen",
      removeFavorite: "Aus Favoriten entfernen",
      copy: "Ausdruck kopieren",
      copied: "Kopiert!",
      history: "Verlauf",
      favorites: "Favoriten",
      result: "Ergebnis",
      ast: "AST",
      hints: "Hinweise",
      placeholder: "FHIRPath-Ausdruck eingeben...",
      loading: "Editor wird geladen...",
      evaluating: "Auswertung...",
      empty: "(leer)",
      noHints: "Keine Optimierungsvorschläge",
      complexity: "Komplexität",
      jit: "JIT",
      noJit: "Kein JIT",
      fhirRelease: "FHIR",
      fhirReleaseTooltip: "FHIR-Version für Typprüfung (is/as/ofType)",
    },
    samples: {
      givenNames: "Vornamen",
      officialName: "Offizieller Name",
      isActive: "Ist aktiv",
      countNames: "Namen zählen",
      hasPhone: "Hat Telefon",
      identifiers: "Identifikatoren",
      typeCheck: "Typprüfung",
    },
    footer: "fhirpath-atollee - Hochleistungs-FHIRPath für TypeScript",
  },
};

export function getTranslations(lang: Language): Translations {
  return translations[lang] || translations[DEFAULT_LANGUAGE];
}
