export const BASE = {
    entryPoints: ['app.ts'],
    target:      ['chrome65'],
    sourcemap:   true,
    bundle:      true,
    // ESM builds override this to skip the window-globals side effect (see app.ts).
    define:      {__SMILES_DRAWER_ESM__: 'false'},
};

// Targets for local development and custom builds:
export const DEV_BUNDLE = Object.assign({}, BASE, {
    outfile: 'dist/smiles-drawer.dev.js',
});

export const DEV_MINIFY = Object.assign({}, BASE, {
    outfile: 'dist/smiles-drawer.dev.min.js',
    minify:  true,
});
