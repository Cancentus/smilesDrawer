/**
 * Renders every molecule in `molecules.js` to a PNG so a human — or an agent —
 * can look at the depictions and spot bad ones.
 *
 *   npm run gallery
 *
 * Output lands in `test/complex/out/` (gitignored):
 *   sheet-N.png    contact sheets, 6 molecules each — start here
 *   <name>.png     one molecule, full size, for a closer look
 *   gallery.html   the same grid, openable in a real browser
 *   metrics.json   per-molecule numbers, worst overlap score first
 *
 * Unlike `complex.test.js`, this runs the whole pipeline in Chromium, so
 * `SvgWrapper.measureText` gets a real 2D context instead of falling back to
 * the `estimateTextSize` approximation JSDOM forces. This is the layout users
 * actually see.
 */
import {chromium}  from 'playwright';
import * as esbuild from 'esbuild';
import fs           from 'node:fs';
import path         from 'node:path';
import {fileURLToPath} from 'node:url';

import * as params from '../../scripts/params.mjs';
import molecules   from './molecules.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const OUT  = path.join(HERE, 'out');

const PER_SHEET = 6;
const CELL      = 460;

// Build from src/ so a layout fix is visible without a separate build step.
await esbuild.build({...params.DEV_BUNDLE, outfile: path.join(REPO, params.DEV_BUNDLE.outfile)});

fs.rmSync(OUT, {recursive: true, force: true});
fs.mkdirSync(OUT, {recursive: true});

const browser = await chromium.launch();
const page    = await browser.newPage({viewport: {width: CELL, height: CELL}, deviceScaleFactor: 2});

await page.setContent('<!DOCTYPE html><html><body style="margin:0;background:#fff"><div id="host"></div></body></html>');
await page.addScriptTag({path: path.join(REPO, params.DEV_BUNDLE.outfile)});

const results = [];

for (const {name, group, smiles} of molecules) {
    const result = await page.evaluate(([smiles]) => {
        const host = document.getElementById('host');
        host.innerHTML = '';

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        host.appendChild(svg);

        try {
            const drawer = new SmilesDrawer.SvgDrawer({isomeric: true});
            drawer.draw(SmilesDrawer.Parser.parse(smiles), svg, 'light');

            // How far anything drawn spills outside the viewport, in drawing
            // units. Must be measured with client rects, not getBBox(): the text
            // groups are positioned with a CSS transform, which getBBox ignores.
            const box   = svg.getBoundingClientRect();
            const scale = Number(svg.getAttribute('viewBox').split(' ')[2]) / box.width;
            let clipped = 0;
            for (const el of svg.querySelectorAll('text, line, polygon')) {
                const r = el.getBoundingClientRect();
                if (r.width === 0 && r.height === 0) continue;
                clipped = Math.max(clipped,
                    box.left - r.left, r.right - box.right,
                    box.top - r.top,   r.bottom - box.bottom);
            }

            return {
                markup:   svg.outerHTML,
                formula:  drawer.getMolecularFormula(),
                overlap:  drawer.getTotalOverlapScore(),
                clipped:  Math.max(0, clipped * scale),
                vertices: drawer.preprocessor.graph.vertices.length,
                rings:    drawer.preprocessor.rings.length,
            };
        }
        catch (err) {
            return {error: String(err && err.message || err)};
        }
    }, [smiles]);

    if (result.error) {
        console.error(`FAILED  ${name}: ${result.error}`);
        results.push({name, group, smiles, error: result.error});
        continue;
    }

    await page.locator('#host svg').screenshot({path: path.join(OUT, `${name}.png`)});
    results.push({name, group, smiles, ...result});
}

// Contact sheets: the same SVGs laid out in a labelled grid.
const cells = results.map(r => `
        <figure>
            <div class="frame">${r.markup || `<p class="err">${r.error}</p>`}</div>
            <figcaption>${r.name}<span>${r.formula || 'render failed'}${
    r.overlap === undefined ? '' : ` &middot; overlap ${r.overlap.toFixed(2)}`}</span></figcaption>
        </figure>`);

const sheets = [];
for (let i = 0; i < cells.length; i += PER_SHEET) {
    sheets.push(`    <section class="sheet">${cells.slice(i, i + PER_SHEET).join('')}\n    </section>`);
}

const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>smilesDrawer complex-molecule gallery</title>
    <style>
        body    {margin: 0; background: #fff; font: 14px system-ui, sans-serif; color: #222;}
        .sheet  {display: grid; grid-template-columns: repeat(3, ${CELL}px); gap: 8px; padding: 8px; width: max-content;}
        figure  {margin: 0;}
        .frame  {width: ${CELL}px; height: ${CELL}px; border: 1px solid #e3e3e3; display: flex;}
        .frame > svg {flex: 1; min-width: 0;}
        figcaption   {padding: 6px 2px 14px; font-weight: 600;}
        figcaption span {display: block; font-weight: 400; color: #777;}
        .err    {color: #c0392b; padding: 12px; font-family: monospace;}
    </style>
</head>
<body>
${sheets.join('\n')}
</body>
</html>
`;

const htmlPath = path.join(OUT, 'gallery.html');
fs.writeFileSync(htmlPath, html);

await page.setViewportSize({width: 3 * CELL + 32, height: 2 * (CELL + 44) + 32});
await page.goto(`file://${htmlPath}`);

const sheetLocators = await page.locator('.sheet').all();
for (const [i, sheet] of sheetLocators.entries()) {
    await sheet.screenshot({path: path.join(OUT, `sheet-${i + 1}.png`)});
}

await browser.close();

// Worst first, so whoever reads this knows which picture to scrutinise.
results.sort((a, b) => (b.overlap ?? Infinity) - (a.overlap ?? Infinity));
fs.writeFileSync(path.join(OUT, 'metrics.json'), JSON.stringify(results.map(({markup, ...r}) => r), null, 4) + '\n');

console.log(`\n${results.length} molecules -> ${path.relative(REPO, OUT)}/  (${sheetLocators.length} sheets)\n`);
console.log('worst overlap first:');
for (const r of results) {
    const score = r.error ? 'ERROR' : r.overlap.toFixed(2).padStart(6);
    const clip  = r.clipped > 0.5 ? `  ** ${r.clipped.toFixed(1)} units CLIPPED off-canvas **` : '';
    console.log(`  ${score}  ${r.name.padEnd(24)} ${r.error || `${r.formula} · ${r.vertices} atoms · ${r.rings} rings`}${clip}`);
}
