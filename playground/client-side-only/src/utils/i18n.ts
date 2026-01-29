/**
 * Internationalization (i18n) for FHIRPath Playground
 * Supports: English (en), German (de)
 * Default: English
 */

export type Language = "en" | "de";

export const STORAGE_KEY = "fhirpath-playground-lang";
export const DEFAULT_LANGUAGE: Language = "en";

export interface Translations {
  nav: {
    playground: string;
    github: string;
    spec: string;
    toggleDark: string;
  };
  headings: {
    title: string;
    subtitle: string;
    resource: string;
    expression: string;
  };
  features: {
    performance: { title: string; description: string };
    optimization: { title: string; description: string };
    history: { title: string; description: string };
  };
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
    jitTooltip: string;
    interpreter: string;
    interpreterTooltip: string;
    noJit: string;
    fhirRelease: string;
    fhirReleaseTooltip: string;
  };
  samples: {
    givenNames: string;
    officialName: string;
    isActive: string;
    countNames: string;
    hasPhone: string;
    identifiers: string;
    typeCheck: string;
  };
  sampleCategories: {
    basic: string;
    existence: string;
    filtering: string;
    subsetting: string;
    combining: string;
    strings: string;
    math: string;
    aggregate: string;
    conversion: string;
    navigation: string;
    fhirSpecific: string;
    boolean: string;
    utility: string;
  };
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
      subtitle: "Interactive FHIRPath expression tester with live evaluation and AST visualization. Powered by fhirpath-atollee.",
      resource: "Resource (JSON)",
      expression: "Expression",
    },
    features: {
      performance: {
        title: "JIT Compiler",
        description: "Native TypeScript with optional JIT compilation and AST caching.",
      },
      optimization: {
        title: "Optimization Hints",
        description: "Real-time suggestions and complexity scoring.",
      },
      history: {
        title: "History & Favorites",
        description: "Clipboard, local history, and favorites.",
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
      jit: "JIT (compiled)",
      jitTooltip: "Just-In-Time compiled: Expression is converted to optimized native code for maximum performance",
      interpreter: "Interpreted",
      interpreterTooltip: "Interpreted execution: Expression is evaluated step-by-step (used for complex expressions)",
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
    sampleCategories: {
      basic: "Basic",
      existence: "Existence",
      filtering: "Filtering",
      subsetting: "Subsetting",
      combining: "Combining",
      strings: "Strings",
      math: "Math",
      aggregate: "Aggregate",
      conversion: "Conversion",
      navigation: "Navigation",
      fhirSpecific: "FHIR-specific",
      boolean: "Boolean",
      utility: "Utility",
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
      subtitle: "Interaktiver FHIRPath-Ausdruckstester mit Live-Auswertung und AST-Visualisierung. Powered by fhirpath-atollee.",
      resource: "Ressource (JSON)",
      expression: "Ausdruck",
    },
    features: {
      performance: {
        title: "JIT-Compiler",
        description: "Natives TypeScript mit optionaler JIT-Kompilierung und AST-Caching.",
      },
      optimization: {
        title: "Optimierungshinweise",
        description: "Echtzeit-Vorschläge und Komplexitätsbewertung.",
      },
      history: {
        title: "Verlauf & Favoriten",
        description: "Zwischenablage, lokaler Verlauf und Favoriten.",
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
      jit: "JIT (kompiliert)",
      jitTooltip: "Just-In-Time kompiliert: Ausdruck wird in optimierten nativen Code umgewandelt für maximale Performance",
      interpreter: "Interpretiert",
      interpreterTooltip: "Interpretierte Ausführung: Ausdruck wird schrittweise ausgewertet (für komplexe Ausdrücke)",
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
    sampleCategories: {
      basic: "Basis",
      existence: "Existenz",
      filtering: "Filterung",
      subsetting: "Teilmengen",
      combining: "Kombinieren",
      strings: "Zeichenketten",
      math: "Mathematik",
      aggregate: "Aggregation",
      conversion: "Konvertierung",
      navigation: "Navigation",
      fhirSpecific: "FHIR-spezifisch",
      boolean: "Boolesch",
      utility: "Hilfsfunktionen",
    },
    footer: "fhirpath-atollee - Hochleistungs-FHIRPath für TypeScript",
  },
};

export function getTranslations(lang: Language): Translations {
  return translations[lang] || translations[DEFAULT_LANGUAGE];
}
