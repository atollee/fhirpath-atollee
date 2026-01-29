import { define } from "../utils.ts";
import { Partial } from "fresh/runtime";

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
        
        {/* Dark mode init script */}
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
                  v0.7.1
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
                
                {/* Dark Mode Toggle */}
                <button
                  id="theme-toggle"
                  type="button"
                  class="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  aria-label="Toggle dark mode"
                >
                  {/* Sun icon (shown in dark mode) */}
                  <svg class="w-5 h-5 hidden dark:block" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd" />
                  </svg>
                  {/* Moon icon (shown in light mode) */}
                  <svg class="w-5 h-5 block dark:hidden" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                  </svg>
                </button>
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
            <p class="text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              fhirpath-atollee - High-performance FHIRPath for TypeScript
              {" • "}
              <a href="https://atollee.com" class="link-atollee hover:underline">atollee</a>
            </p>
          </div>
        </footer>
        
        {/* Theme toggle script */}
        <script dangerouslySetInnerHTML={{ __html: `
          document.getElementById('theme-toggle').addEventListener('click', function() {
            const html = document.documentElement;
            if (html.classList.contains('dark')) {
              html.classList.remove('dark');
              localStorage.setItem('theme', 'light');
            } else {
              html.classList.add('dark');
              localStorage.setItem('theme', 'dark');
            }
          });
        `}} />
      </body>
    </html>
  );
});
