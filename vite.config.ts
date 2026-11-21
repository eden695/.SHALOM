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

function shalomPrecachePlugin(): Plugin {
  return {
    name: 'shalom-precache-manifest',
    apply: 'build',
    writeBundle(outputOptions) {
      const outDir = outputOptions.dir
        ? path.resolve(outputOptions.dir)
        : path.resolve(__dirname, 'dist');
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
        /const CACHE_NAME = 'shalom-cache-v12';/,
        `const CACHE_NAME = 'shalom-cache-v12-${manifestHash}';`
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
    plugins: [react(), tailwindcss(), shalomPrecachePlugin()],
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
