# FHIRPath Playground (Client-Side)

A static, client-side version of the FHIRPath Playground that runs entirely in the browser. Perfect for hosting on GitHub Pages.

## Features

- 🚀 **No Server Required** - Runs entirely in the browser
- ⚡ **JIT Compilation** - Optional JIT for better performance
- 📊 **AST Visualization** - See the parsed expression tree
- 💡 **Optimization Hints** - Real-time suggestions
- 🌙 **Dark Mode** - Automatic or manual toggle
- 🌐 **Multi-language** - English and German

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deployment

### GitHub Pages (Automatic)

Push to `main` branch - the GitHub Action will automatically build and deploy.

### Manual Deployment

```bash
npm run build
# Upload contents of `dist/` to any static hosting
```

## How It Works

The playground uses:
- **Vite** - Build tool and dev server
- **Preact** - Lightweight React alternative
- **Monaco Editor** - VS Code's editor component (loaded from CDN)
- **fhirpath-atollee** - FHIRPath library (loaded from esm.sh CDN)
- **Tailwind CSS** - Utility-first styling

All evaluation happens client-side in the browser - no server calls needed!

## Live Demo

Visit: https://atollee.github.io/fhirpath-atollee/
