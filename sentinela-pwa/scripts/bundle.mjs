// Gera um único HTML autossuficiente (CSS + JS embutidos) — útil para pré-visualizar/publicar.
// Uso: node scripts/bundle.mjs saida.html
import { readFileSync, writeFileSync } from 'node:fs';
const order = ['core', 'nlp', 'ui', 'store', 'summary', 'vision', 'reminders', 'ai', 'app'];
let js = 'const __m = {};\n';
for (const name of order) {
  let src = readFileSync(new URL(`../js/${name}.js`, import.meta.url), 'utf8'); const names = [];
  src = src.replace(/^import \* as (\w+) from '\.\/(\w+)\.js';?$/gm, (_, a, m) => `const ${a} = __m.${m};`);
  src = src.replace(/^import \{([^}]+)\} from '\.\/(\w+)\.js';?$/gm, (_, list, m) => `const {${list.replace(/ as /g, ': ')}} = __m.${m};`);
  src = src.replace(/^export (const|function|async function|let) ([\w$]+)/gm, (_, k, n) => { names.push(n); return `${k} ${n}`; });
  src = src.replace(/^export \{([^}]+)\};?$/gm, (_, l) => { names.push(...l.split(',').map((x) => x.trim())); return ''; });
  js += `__m.${name} = (() => {\n${src}\nreturn { ${names.join(', ')} };\n})();\n`;
}
const css = readFileSync(new URL('../css/app.css', import.meta.url), 'utf8');
const html = `<title>Sentinela Tático</title>
<meta name="theme-color" content="#060a12">
<style>${css}</style>
<script>(function(){function run(){${js}}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();})();</script>
`;
writeFileSync(process.argv[2] || 'sentinela.html', html);
console.log('ok', html.length, 'bytes');
