#!/usr/bin/env node
'use strict';

/**
 * Production build script for PTA Aniversário landing page.
 *
 * Output structure:
 *   dist/index.html        – minified HTML + SEO
 *   dist/css/tailwind.css  – purged + minified Tailwind
 *   dist/css/style.css     – extracted + minified inline styles
 *   dist/js/main.js        – extracted + minified inline JS
 *   dist/assets/           – static assets (images, SVGs)
 */

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

/* ─────────────── helpers ─────────────── */
const log  = msg => console.log(`\n[build] ${msg}`);
const kb   = s   => (Buffer.byteLength(s, 'utf-8') / 1024).toFixed(1) + ' KB';

function copyDir(src, dst, skipExt = null) {
  fs.mkdirSync(dst, { recursive: true });
  fs.readdirSync(src).forEach(f => {
    if (skipExt && f.toLowerCase().endsWith(skipExt)) return;
    const s = path.join(src, f), d = path.join(dst, f);
    fs.statSync(s).isDirectory() ? copyDir(s, d, skipExt) : fs.copyFileSync(s, d);
  });
}

function printTree(dir) {
  const rows = [];
  let total  = 0;
  (function walk(d) {
    fs.readdirSync(d).forEach(f => {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else { const sz = fs.statSync(p).size; total += sz; rows.push([p.replace(ROOT + '/', ''), sz]); }
    });
  })(dir);
  rows.sort((a, b) => b[1] - a[1]);
  console.log('\n  dist output:');
  rows.forEach(([f, sz]) => console.log(`    ${f.padEnd(52)} ${(sz / 1024).toFixed(1)} KB`));
  console.log(`    ${'─'.repeat(66)}`);
  console.log(`    ${'TOTAL'.padEnd(52)} ${(total / 1024).toFixed(1)} KB`);
}

/* ─────────────── main ─────────────── */
async function main() {

  /* 1 ── Clean + create dist folders ─────────────────── */
  log('Cleaning dist/...');
  if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true });
  ['css', 'js', 'assets/professores'].forEach(d =>
    fs.mkdirSync(path.join(DIST, d), { recursive: true })
  );

  /* 2 ── Read source HTML ─────────────────────────────── */
  log('Reading index.html...');
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');

  /* 3 ── Inject SEO / meta tags ───────────────────────── */
  log('Injecting SEO meta tags...');
  const SEO = `
  <meta name="description" content="A maior oferta da história da PTA. Pós-Graduação em Biomecânica, Master Perform, Mapa da Consultoria Online e ingresso no Summit PTA 2026 — tudo em um único acesso. R$ 3.990 ou 18x de R$ 249.">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="https://pos.personaltraineracademy.com.br/">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Personal Trainer Academy">
  <meta property="og:title" content="Oferta de Aniversário PTA | Acesso Completo">
  <meta property="og:description" content="A maior oferta da história da PTA reúne 4 programas transformadores em um único acesso por R$ 3.990.">
  <meta property="og:url" content="https://pos.personaltraineracademy.com.br/">
  <meta property="og:image" content="https://pos.personaltraineracademy.com.br/assets/web.webp">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Oferta de Aniversário PTA | Acesso Completo">
  <meta name="twitter:description" content="A maior oferta da história da PTA. 4 programas em um único acesso.">
  <meta name="twitter:image" content="https://pos.personaltraineracademy.com.br/assets/web.webp">
  <link rel="dns-prefetch" href="https://cdnjs.cloudflare.com">
  <link rel="dns-prefetch" href="https://unpkg.com">`;

  // Insert right after <meta name="viewport" ...>
  html = html.replace(/(<meta[^>]+name=["']viewport["'][^>]*>)/, `$1${SEO}`);

  /* 4 ── Extract inline <style> blocks ───────────────── */
  log('Extracting inline styles...');
  const cssChunks = [];
  html = html.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_, content) => {
    cssChunks.push(content);
    return '';
  });
  const rawCss = cssChunks.join('\n');

  /* 5 ── Extract inline <script> blocks ──────────────── */
  log('Extracting inline scripts...');
  const jsChunks = [];
  html = html.replace(/<script([^>]*)>([\s\S]*?)<\/script>/gi, (match, attrs, content) => {
    // keep externals as-is
    if (/\bsrc\s*=/i.test(attrs)) return match;
    // keep GTM inline snippet (critical tracking)
    if (content.includes('gtm.start')) return match;
    // drop empty blocks
    if (!content.trim()) return '';
    // drop Tailwind CDN config (replaced by CLI-generated CSS)
    if (content.includes('tailwind.config')) return '';
    // collect all other inline JS
    jsChunks.push(content.trim());
    return '';
  });
  const rawJs = jsChunks.join('\n\n');

  /* 6 ── Remove Tailwind CDN <script src> tag ─────────── */
  html = html.replace(
    /<script\s+src="https:\/\/cdn\.tailwindcss\.com[^"]*"\s*><\/script>\s*/gi,
    ''
  );

  /* 7 ── Update asset paths ────────────────────────────── */
  log('Updating asset paths...');
  html = html
    .replace(/(?:src|href)="\.\/logoPTA\.svg"/g,    m => m.replace('./', 'assets/'))
    .replace(/src="\.\/web\.webp"/g,                'src="assets/web.webp"')
    .replace(/srcset="\.\/web\.webp"/g,             'srcset="assets/web.webp"')
    .replace(/src="\.\/MOBILE\.webp"/g,             'src="assets/MOBILE.webp"')
    .replace(/srcset="\.\/MOBILE\.webp"/g,          'srcset="assets/MOBILE.webp"')
    .replace(/src="\.\/professores\//g,             'src="assets/professores/')
    .replace(/srcset="\.\/professores\//g,          'srcset="assets/professores/');

  /* 8 ── Inject CSS + JS link/script tags ─────────────── */
  // Add CSS links right before </head>
  html = html.replace(
    '</head>',
    '  <link rel="stylesheet" href="css/tailwind.css">\n  <link rel="stylesheet" href="css/style.css">\n</head>'
  );
  // Add main.js right before </body>
  html = html.replace('</body>', '<script src="js/main.js"></script>\n</body>');

  /* 9 ── Copy static assets ────────────────────────────── */
  log('Copying assets...');
  ['logoPTA.svg', 'web.webp', 'MOBILE.webp'].forEach(f => {
    const src = path.join(ROOT, f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(DIST, 'assets', f));
    else console.warn(`  ⚠  missing: ${f}`);
  });
  const profSrc = path.join(ROOT, 'professores');
  if (fs.existsSync(profSrc)) copyDir(profSrc, path.join(DIST, 'assets', 'professores'), '.svg');

  /* 10 ── Generate purged + minified Tailwind CSS ─────── */
  log('Generating purged Tailwind CSS...');
  const twIn = path.join(ROOT, '_tw_in.css');
  fs.writeFileSync(twIn,
    '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n'
  );
  try {
    execSync(
      `node_modules/.bin/tailwindcss -i "${twIn}" -o "${path.join(DIST, 'css', 'tailwind.css')}" --minify`,
      { stdio: 'inherit', cwd: ROOT }
    );
  } finally {
    if (fs.existsSync(twIn)) fs.unlinkSync(twIn);
  }
  const twSize = fs.statSync(path.join(DIST, 'css', 'tailwind.css')).size;
  console.log(`  tailwind.css → ${(twSize / 1024).toFixed(1)} KB (purged)`);

  /* 11 ── Minify custom CSS ────────────────────────────── */
  log('Minifying custom CSS...');
  const CleanCSS = require('clean-css');
  const { styles: minCss, errors: cssErrors } = new CleanCSS({ level: 2 }).minify(rawCss);
  if (cssErrors.length) console.warn('  CSS warnings:', cssErrors);
  fs.writeFileSync(path.join(DIST, 'css', 'style.css'), minCss);
  console.log(`  style.css  ${kb(rawCss)} → ${kb(minCss)}`);

  /* 12 ── Minify JS ─────────────────────────────────────── */
  log('Minifying JS...');
  const { minify: terser } = require('terser');
  const { code: minJs, error: jsError } = await terser(rawJs, {
    compress: {
      drop_console: false,   // keep console.error (webhook fallback logging)
      passes: 2
    },
    mangle: true,
    format: { comments: false }
  });
  if (jsError) throw jsError;
  fs.writeFileSync(path.join(DIST, 'js', 'main.js'), minJs);
  console.log(`  main.js    ${kb(rawJs)} → ${kb(minJs)}`);

  /* 13 ── Minify HTML ──────────────────────────────────── */
  log('Minifying HTML...');
  const { minify: htmlMin } = require('html-minifier-terser');
  const minHtml = await htmlMin(html, {
    collapseWhitespace:          true,
    removeComments:              true,
    removeRedundantAttributes:   true,
    removeScriptTypeAttributes:  true,
    removeStyleLinkTypeAttributes: true,
    useShortDoctype:             true,
    minifyCSS:                   false,  // handled separately
    minifyJS:                    false,  // handled separately
    // Never touch these — tracking + form IDs must stay intact:
    ignoreCustomComments:        [],
  });
  fs.writeFileSync(path.join(DIST, 'index.html'), minHtml);
  console.log(`  index.html ${kb(html)} → ${kb(minHtml)}`);

  /* 14 ── Done ─────────────────────────────────────────── */
  log('✅  Build complete!');
  printTree(DIST);
}

main().catch(err => {
  console.error('\n❌ Build failed:', err.message || err);
  process.exit(1);
});
