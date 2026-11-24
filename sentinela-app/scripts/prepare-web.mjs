// Copia a interface web (../sentinela-pwa) para www/, que é o que o Capacitor empacota no APK.
import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '../../sentinela-pwa');
const dst = path.resolve(here, '../www');
rmSync(dst, { recursive: true, force: true });
mkdirSync(dst, { recursive: true });
for (const item of ['index.html', 'manifest.webmanifest', 'css', 'js', 'icons', 'sounds']) {
  const from = path.join(src, item);
  if (!existsSync(from)) throw new Error(`Faltando em sentinela-pwa: ${item}`);
  cpSync(from, path.join(dst, item), { recursive: true });
}
console.log('Interface web copiada para', dst);
