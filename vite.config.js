import { defineConfig } from 'vite';

export default defineConfig(({ command, isPreview }) => ({
  // Keep the dev server at /; builds and their local preview match the project
  // site at https://viridiphile.github.io/finger-frame/.
  base: command === 'build' || isPreview ? '/finger-frame/' : '/',
}));
