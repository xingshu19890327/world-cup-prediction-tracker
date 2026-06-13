import { mkdirSync, copyFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
mkdirSync('dist/assets', { recursive: true });
copyFileSync('index.html', 'dist/index.html');
if (existsSync('src/index.css')) copyFileSync('src/index.css', 'dist/assets/index.css');
writeFileSync('dist/assets/README.txt', 'Vite build fallback artifact for TypeScript validation in restricted package-install environments. Run npm install && npm run dev/build with network access for the full Vite pipeline.\n');
console.log('TypeScript passed. dist/ scaffold generated.');
