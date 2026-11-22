import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, type Plugin } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function collectRelativeFiles(dirPath: string, baseDir: string): string[] {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectRelativeFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      const rel = path.relative(baseDir, fullPath).split(path.sep).join('/');
      results.push(`./${rel}`);
    }
  }
  return results;
}

function shalomOfflineUniversalPlugin(): Plugin {
  return {
    name: 'shalom-offline-universal',
    apply: 'build',
    writeBundle(outputOptions) {
      const outDir = outputOptions.dir
        ? path.resolve(outputOptions.dir)
        : path.resolve(__dirname, 'dist');

      // 1. Make built index.html 100% compatible with both HTTP PWA & file:// Android WebView (Website 2 APK Builder)
      const htmlPath = path.join(outDir, 'index.html');
      if (fs.existsSync(htmlPath)) {
        let html = fs.readFileSync(htmlPath, 'utf8');
        // Strip crossorigin from stylesheet links so file:// WebViews load CSS without CORS errors
        html = html.replace(
          /<link\s+rel="stylesheet"\s+crossorigin\s+href="([^"]+)"\s*>/gi,
          '<link rel="stylesheet" href="$1">'
        );
        // Convert <script type="module" crossorigin src="..."> into classic deferred script for file:// & HTTP compatibility
        const moduleScriptMatch = html.match(
          /<script\s+type="module"\s+crossorigin\s+src="([^"]+)"\s*><\/script>/i
        );
        if (moduleScriptMatch) {
          const scriptSrc = moduleScriptMatch[1];
          html = html.replace(moduleScriptMatch[0], '');
          html = html.replace(
            '</body>',
            `    <script defer src="${scriptSrc}"></script>\n  </body>`
          );
        }
        fs.writeFileSync(htmlPath, html, 'utf8');
      }

      // 2. Inject complete relative precache manifest into sw.js for instant offline PWA startup
      const swPath = path.join(outDir, 'sw.js');
      if (!fs.existsSync(swPath)) return;

      const coreAssets = [
        './',
        './index.html',
        './manifest.json',
        './shalom_logo.jpg',
        './shalom_logo_512x512.png',
        './shalom_logo_512x512.jpg',
        './icon.png',
      ].filter((assetRel) => {
        if (assetRel === './') return true;
        return fs.existsSync(path.join(outDir, assetRel.replace('./', '')));
      });

      const bundledAssets = collectRelativeFiles(path.join(outDir, 'assets'), outDir).sort();
      const allAssets = Array.from(new Set([...coreAssets, ...bundledAssets]));

      const manifestHash = crypto
        .createHash('sha1')
        .update(allAssets.join('|'))
        .digest('hex')
        .slice(0, 8);

      let swContent = fs.readFileSync(swPath, 'utf8');
      swContent = swContent.replace(
        /const CACHE_NAME = 'shalom-cache-[^']+';/,
        `const CACHE_NAME = 'shalom-cache-v13-${manifestHash}';`
      );
      swContent = swContent.replace(
        /const ASSETS_TO_CACHE = \[[\s\S]*?\];/,
        `const ASSETS_TO_CACHE = ${JSON.stringify(allAssets, null, 2)};`
      );

      fs.writeFileSync(swPath, swContent, 'utf8');
    },
  };
}

export default defineConfig(() => {
  return {
    base: './',
    define: {
      __SHALOM_APP_VERSION__: JSON.stringify('2.5.0'),
      __SHALOM_BUILD_DATE__: JSON.stringify(new Date().toISOString().split('T')[0]),
    },
    plugins: [react(), tailwindcss(), shalomOfflineUniversalPlugin()],
    build: {
      cssCodeSplit: false,
      rollupOptions: {
        output: {
          format: 'iife' as const,
          name: 'ShalomApp',
          inlineDynamicImports: true,
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
