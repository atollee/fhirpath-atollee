import { define } from "../utils.ts";
import { Partial } from "fresh/runtime";

export default define.page(function App({ Component, url }) {
  return (
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>FHIRPath Playground - atollee</title>
        <meta name="description" content="Interactive FHIRPath expression tester with live evaluation, AST visualization, and optimization hints." />
        
        {/* Open Graph for Social Sharing */}
        <meta property="og:title" content="FHIRPath Playground" />
        <meta property="og:description" content="Test FHIRPath expressions interactively with live evaluation and optimization hints." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={url.href} />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="FHIRPath Playground" />
        <meta name="twitter:description" content="Test FHIRPath expressions interactively" />
        
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body class="bg-gray-50 dark:bg-gray-900 min-h-screen" f-client-nav>
        <nav class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between h-14">
              <div class="flex items-center space-x-4">
                <a href="/" class="flex items-center space-x-2">
                  <span class="text-2xl">🔬</span>
                  <span class="font-bold text-lg text-gray-900 dark:text-white">
                    FHIRPath Playground
                  </span>
                </a>
                <span class="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                  v0.7.1
                </span>
              </div>
              <div class="flex items-center space-x-4">
                <a
                  href="https://gitlab.atollee.com/fhir/fhirpath-atollee"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  GitLab
                </a>
                <a
                  href="https://hl7.org/fhirpath/"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  FHIRPath Spec
                </a>
              </div>
            </div>
          </div>
        </nav>
        
        <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Partial name="main-content">
            <Component />
          </Partial>
        </main>
        
        <footer class="border-t border-gray-200 dark:border-gray-700 mt-8">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <p class="text-center text-sm text-gray-500 dark:text-gray-400">
              fhirpath-atollee - High-performance FHIRPath for TypeScript
              {" • "}
              <a href="https://atollee.com" class="hover:underline">atollee</a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
});
