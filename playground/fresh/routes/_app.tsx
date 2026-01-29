import { define } from "../utils.ts";
import { Partial } from "fresh/runtime";
import ThemeToggle from "../islands/ThemeToggle.tsx";
import LanguageSwitcher from "../islands/LanguageSwitcher.tsx";
import { Footer } from "../islands/TranslatedContent.tsx";

export default define.page(function App({ Component, url }) {
  // Dark mode script to run before render (prevents flash)
  const darkModeScript = `
    (function() {
      const stored = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (stored === 'dark' || (!stored && prefersDark)) {
        document.documentElement.classList.add('dark');
      }
    })();
  `;

  return (
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>FHIRPath Playground - atollee</title>
        <meta name="description" content="Interactive FHIRPath expression tester with live evaluation, AST visualization, and optimization hints." />
        
        {/* Favicon */}
        <link rel="icon" type="image/png" href="/healthruntime-logo.png" />
        
        {/* Open Graph for Social Sharing */}
        <meta property="og:title" content="FHIRPath Playground - atollee" />
        <meta property="og:description" content="Test FHIRPath expressions interactively with live evaluation and optimization hints. 50-75x faster than fhirpath.js." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={url.href} />
        <meta property="og:image" content="/healthruntime-logo.png" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="FHIRPath Playground - atollee" />
        <meta name="twitter:description" content="Test FHIRPath expressions interactively" />
        
        {/* Theme color for mobile browsers - atollee ocean blue */}
        <meta name="theme-color" content="rgb(30, 210, 255)" />
        
        <link rel="stylesheet" href="/styles.css" />
        
        {/* Dark mode init script - runs before render to prevent flash */}
        <script dangerouslySetInnerHTML={{ __html: darkModeScript }} />
      </head>
      <body class="min-h-screen transition-theme" f-client-nav>
        <nav class="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between h-14">
              {/* Logo & Title */}
              <div class="flex items-center space-x-2 sm:space-x-4">
                <a href="/" class="flex items-center space-x-2">
                  <img src="/healthruntime-logo.png" alt="HealthRuntime" class="h-7 sm:h-8 w-auto" />
                  <span class="font-bold text-base sm:text-lg text-slate-900 dark:text-white hidden xs:inline">
                    FHIRPath Playground
                  </span>
                  <span class="font-bold text-base sm:text-lg text-slate-900 dark:text-white xs:hidden">
                    FHIRPath
                  </span>
                </a>
                <span class="badge-version px-2 py-0.5 text-xs font-medium rounded hidden sm:inline">
                  v0.7.3
                </span>
              </div>
              
              {/* Navigation Links & Dark Mode Toggle */}
              <div class="flex items-center space-x-2 sm:space-x-4">
                <a
                  href="https://github.com/atollee/fhirpath-atollee"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 link-atollee transition-colors"
                >
                  GitHub
                </a>
                <a
                  href="https://hl7.org/fhirpath/"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 link-atollee transition-colors hidden sm:inline"
                >
                  FHIRPath Spec
                </a>
                
                {/* Language Switcher */}
                <LanguageSwitcher />
                
                {/* Dark Mode Toggle - Island component */}
                <ThemeToggle />
              </div>
            </div>
          </div>
        </nav>
        
        <main class="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
          <Partial name="main-content">
            <Component />
          </Partial>
        </main>
        
        <footer class="border-t border-slate-200 dark:border-slate-700 mt-8 bg-white dark:bg-slate-800">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <Footer />
          </div>
        </footer>
      </body>
    </html>
  );
});
