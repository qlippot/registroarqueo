// Une la lógica y la plantilla en una sola página: dist/index.html
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const core = readFileSync(new URL('./src/core.js', import.meta.url), 'utf8');
const tpl = readFileSync(new URL('./src/index.template.html', import.meta.url), 'utf8');
if (core.includes('</script')) throw new Error('core.js no puede contener </script');
if (!tpl.includes('/*CORE*/')) throw new Error('falta /*CORE*/ en la plantilla');
mkdirSync(new URL('./dist/', import.meta.url), { recursive: true });
writeFileSync(new URL('./dist/index.html', import.meta.url), tpl.replace('/*CORE*/', core));
console.log('dist/index.html listo');
