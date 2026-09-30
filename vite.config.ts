import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Makes the production build openable straight from disk (file://).
 *
 * Vite emits `<script type="module" crossorigin>`. Browsers refuse to load a
 * module script from a file:// page - the request counts as cross-origin -
 * so double-clicking index.html would show a blank screen. The bundle is
 * built as a single self-contained IIFE (see `output.format` below), which
 * needs no module loader, so the tag can safely be downgraded to a plain
 * deferred script. The same output is fine on any static host too.
 */
function classicScriptForFileProtocol(): Plugin {
  return {
    name: 'belajar-yuk:classic-script',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html
          .replace(/<script\s+type="module"\s+crossorigin\s+/g, '<script defer ')
          .replace(/<script\s+type="module"\s+/g, '<script defer ')
          .replace(/(<link\b[^>]*?)\scrossorigin(?:="[^"]*")?/g, '$1');
      },
    },
  };
}

export default defineConfig({
  // Relative URLs, so the folder works from any location: a USB stick, a
  // subfolder on a web host, or straight off the desktop.
  base: './',
  plugins: [react(), tailwindcss(), classicScriptForFileProtocol()],
  build: {
    // Emit the styles as a real .css file. Left alone, an IIFE bundle folds
    // them into the script, so the page would paint unstyled first.
    cssCodeSplit: false,
    rolldownOptions: {
      output: {
        format: 'iife',
        // One file, no lazy chunks: a classic script cannot import others.
        codeSplitting: false,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
