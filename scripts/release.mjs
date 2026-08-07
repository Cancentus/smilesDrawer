import * as esbuild from 'esbuild';
import * as params  from './params.mjs';

// Regular JavaScript
await esbuild.build(Object.assign({}, params.BASE, {
    outfile: 'dist/smiles-drawer.js',
    format:  'iife',
    minify:  false,
}));

// Minified JavaScript
// These two are the bundles committed to Git (package.json points at them), so
// they carry no sourceMappingURL — the maps themselves are not committed.
await esbuild.build(Object.assign({}, params.BASE, {
    outfile:   'dist/smiles-drawer.min.js',
    format:    'iife',
    minify:    true,
    sourcemap: false,
}));

// Regular JavaScript Module
await esbuild.build(Object.assign({}, params.BASE, {
    outfile: 'dist/smiles-drawer.mjs',
    format:  'esm',
    minify:  false,
    define:  {__SMILES_DRAWER_ESM__: 'true'},
}));

// Minified JavaScript Module
await esbuild.build(Object.assign({}, params.BASE, {
    outfile:   'dist/smiles-drawer.min.mjs',
    format:    'esm',
    minify:    true,
    sourcemap: false,
    define:    {__SMILES_DRAWER_ESM__: 'true'},
}));
