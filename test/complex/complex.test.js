/**
 * Layout-quality tests for complex molecules.
 *
 * `test/regression/rendering.test.js` proves the pipeline does not throw. This
 * file proves the resulting *drawing* is sane: no NaN coordinates, no atoms on
 * top of each other, bonds at a consistent length, non-empty SVG. Metrics are
 * additionally snapshotted so an accidental layout regression shows up as a
 * diff even when it stays within the hard bounds.
 *
 * After an intentional layout change:  npx vitest run test/complex -u
 * To look at the drawings:             npm run gallery
 */
import {describe, it, expect} from 'vitest';
import {createJSDOM}          from '../helpers';

import Parser    from '../../src/Parser.js';
import SvgDrawer from '../../src/SvgDrawer.js';
import molecules from './molecules.mjs';

/**
 * Renders a SMILES and collects layout metrics from the positioned graph.
 * @param {String} smiles
 */
function measure(smiles) {
    const dom = createJSDOM();
    const svg = dom.window.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    dom.window.document.body.appendChild(svg);

    const drawer = new SvgDrawer({isomeric: true});
    drawer.draw(Parser.parse(smiles), svg, 'light');

    const pp        = drawer.preprocessor;
    const positions = pp.graph.vertices.map(v => v.position);

    // Bond lengths, and the closest approach of any two atoms.
    const bonds = pp.graph.edges.map((edge) => {
        const a = pp.graph.vertices[edge.sourceId].position;
        const b = pp.graph.vertices[edge.targetId].position;
        return Math.hypot(a.x - b.x, a.y - b.y);
    });

    let minAtomDist = Infinity;
    for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
            const d = Math.hypot(positions[i].x - positions[j].x, positions[i].y - positions[j].y);
            if (d < minAtomDist) {
                minAtomDist = d;
            }
        }
    }

    const sorted = [...bonds].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const mean   = bonds.reduce((s, x) => s + x, 0) / bonds.length;
    const sd     = Math.sqrt(bonds.reduce((s, x) => s + (x - mean) ** 2, 0) / bonds.length);

    return {
        svg,
        positions,
        bondLength:   pp.opts.bondLength,
        medianBond:   median,
        minAtomDist:  minAtomDist,
        // Coefficient of variation: bonds should be near-uniform, so this stays small.
        bondLengthCV: sd / mean,
        vertices:     pp.graph.vertices.length,
        edges:        pp.graph.edges.length,
        rings:        pp.rings.length,
        overlap:      drawer.getTotalOverlapScore(),
    };
}

const round = (n, places) => Number(n.toFixed(places));

for (const {name, group, smiles, knownIssue} of molecules) {
describe(`${group}: ${name}`, () => {
    // One render per molecule; the invariants and the snapshot both read it.
    const m = measure(smiles);

    // A molecule with a `knownIssue` documents a real layout defect that has
    // not been fixed yet. `it.fails` keeps the suite honest in both directions:
    // it stays green while the bug exists, and starts failing with "expected to
    // fail but passed" the moment someone fixes it, forcing the marker's removal.
    const check = (key, title, fn) => (knownIssue === key ? it.fails : it)(title, fn);

    it('positions every atom at finite coordinates', () => {
        expect(m.vertices).toBeGreaterThan(0);
        for (const p of m.positions) {
            expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
        }
    });

    it('emits a non-empty SVG with no NaN in it', () => {
        // NaN in a coordinate makes the bond silently vanish in a browser,
        // which no graph-level assertion would catch. Bonds are <line> and
        // stereo wedges are <polygon>.
        expect(m.svg.outerHTML).not.toMatch(/NaN/);
        expect(m.svg.querySelectorAll('line, polygon').length).toBeGreaterThan(0);

        if (/[NOSPFnos]|Cl|Br|\[/.test(smiles)) {
            expect(m.svg.querySelectorAll('text').length).toBeGreaterThan(0);
        }
    });

    check('atomSpacing', 'does not draw two atoms on top of each other', () => {
        expect(m.minAtomDist).toBeGreaterThan(0.1 * m.bondLength);
    });

    check('bondLength', 'draws bonds at a consistent length', () => {
        // Wide bounds on purpose: cage systems are drawn as Schlegel diagrams,
        // which legitimately rescale (dodecahedrane sits at ~1.3x). The point
        // is to catch a layout that has collapsed or exploded, not to police
        // aesthetics — that is what the gallery is for. The CV catches bonds
        // that are inconsistent with each other regardless of overall scale.
        expect(m.medianBond).toBeGreaterThan(0.6 * m.bondLength);
        expect(m.medianBond).toBeLessThan(1.4 * m.bondLength);
        expect(m.bondLengthCV).toBeLessThan(0.35);
    });

    it('matches the recorded layout metrics', () => {
        expect({
            vertices:     m.vertices,
            edges:        m.edges,
            rings:        m.rings,
            overlap:      round(m.overlap, 2),
            bondLengthCV: round(m.bondLengthCV, 3),
            minAtomDist:  round(m.minAtomDist, 2),
        }).toMatchSnapshot();
    });
});
}
