import {describe, it, expect} from 'vitest';
import {createJSDOM}          from '../helpers';

import AtomValueOverlay from '../../src/AtomValueOverlay.js';
import Parser            from '../../src/Parser.js';
import SvgDrawer          from '../../src/SvgDrawer.js';

function layout(smiles, explicitHydrogens = false) {
    const tree = Parser.parse(smiles);
    const drawer = new SvgDrawer({explicitHydrogens});
    drawer.preprocessor.initDraw(tree, 'light', false, []);
    drawer.preprocessor.processGraph();
    const vertices = drawer.preprocessor.graph.vertices;
    return {
        all:   vertices,
        heavy: vertices.filter((v) => v.value.element !== 'H'),
    };
}

function stubSvg(viewBox) {
    const dom = createJSDOM();
    const svg = dom.window.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', viewBox);
    dom.window.document.body.appendChild(svg);
    return svg;
}

describe('AtomValueOverlay.parseAtomValueBundle', () => {
    it('parses generic dataset JSON', () => {
        const bundle = AtomValueOverlay.parseAtomValueBundle({
            datasets: {
                a: {
                    label:   'Method A',
                    entries: [{atom_index: 0, parts: [{text: '4.2', color: '#e74c3c'}]}],
                },
            },
        });

        expect(bundle.datasets.a.label).toBe('Method A');
        expect(bundle.datasets.a.entries[0].parts[0].text).toBe('4.2');
    });

    it('parses pka_methods via adapter', () => {
        const bundle = AtomValueOverlay.parseAtomValueBundle({
            pka_methods: {
                moitessier: {
                    provider: 'moitessier',
                    sites:    [
                        {atom_index: 0, element: 'N', role: 'base', pka: 8.98},
                        {atom_index: 0, element: 'N', role: 'acid', pka: 9.85},
                    ],
                },
            },
        });

        expect(bundle.datasets.moitessier.label).toBe('Moitessier');
        expect(bundle.datasets.moitessier.entries).toHaveLength(1);
        expect(bundle.datasets.moitessier.entries[0].parts.map((p) => p.text)).toEqual(['9.0', '9.8']);
        expect(bundle.datasets.moitessier.entries[0].parts[0].title).toBe('base');
        expect(bundle.datasets.moitessier.entries[0].parts[1].title).toBe('acid');
    });
});

describe('AtomValueOverlay.apply', () => {
    it('places one label per distinct atom and combines micro-pKa on one atom', () => {
        const smiles = 'NCCCOC1C(C2=CC(NC3=NC=C(C#N)N=C3)=NN2)=C(OC)C=CC=1';
        const {all, heavy} = layout(smiles, false);
        const xs = heavy.map((v) => v.position.x);
        const ys = heavy.map((v) => v.position.y);
        const vb = [
            Math.min(...xs),
            Math.min(...ys),
            Math.max(...xs) - Math.min(...xs),
            Math.max(...ys) - Math.min(...ys),
        ];

        const svg = stubSvg(vb.join(' '));
        const bundle = AtomValueOverlay.parsePkaDatasets({
            sites: [
                {atom_index: 0, element: 'N', role: 'base', pka: 8.98},
                {atom_index: 12, element: 'N', role: 'base', pka: 8.69},
                {atom_index: 16, element: 'N', role: 'base', pka: 7.78},
                {atom_index: 19, element: 'N', role: 'base', pka: 8.15},
                {atom_index: 20, element: 'N', role: 'base', pka: 8.12},
                {atom_index: 0, element: 'N', role: 'acid', pka: 9.85},
                {atom_index: 10, element: 'N', role: 'acid', pka: 9.92},
                {atom_index: 20, element: 'N', role: 'acid', pka: 10.02},
            ],
        });

        AtomValueOverlay.apply(
            svg,
            bundle.datasets.default,
            {vertices: heavy, atomOrder: null, allVertices: all},
        );

        const labels = svg.querySelectorAll('.atom-value-overlay text');
        expect(labels.length).toBe(6);

        const positions = [...labels].map((t) => `${t.getAttribute('x')},${t.getAttribute('y')}`);
        expect(new Set(positions).size).toBe(labels.length);

        const rendered = [...labels].map((t) => [...t.querySelectorAll('tspan')].map((c) => c.textContent).join(''));
        expect(rendered).toContain('9.0/9.8');
        expect(rendered).toContain('8.1/10.0');
        expect(rendered).toContain('7.8');

        // Values are set smaller than the atom labels (fontSizeLarge 11pt = 14.67 user units).
        for (const t of labels) {
            expect(Number(t.getAttribute('font-size'))).toBeLessThan(11 * 4 / 3);
        }

        const [fx, fy, fw, fh] = svg.getAttribute('viewBox').split(/[\s,]+/).map(Number);
        for (const t of labels) {
            const x = Number(t.getAttribute('x'));
            const y = Number(t.getAttribute('y'));
            expect(x).toBeGreaterThanOrEqual(fx);
            expect(x).toBeLessThanOrEqual(fx + fw);
            expect(y).toBeGreaterThanOrEqual(fy);
            expect(y).toBeLessThanOrEqual(fy + fh);
        }
        expect(fw).toBeGreaterThanOrEqual(vb[2]);
        expect(fh).toBeGreaterThanOrEqual(vb[3]);
    });

    it('maps atom indices through atomOrder for explicit-H SMILES', () => {
        const explicit = layout('[H]OC(=O)[C@@]([H])(N([H])[H])C([H])([H])[H]', true);
        const atomOrder = [5, 3, 4, 1, 0, 2];

        const svg = stubSvg('0 0 100 100');
        AtomValueOverlay.apply(
            svg,
            {
                label:   'test',
                entries: [{atom_index: 0, parts: [{text: '9.0', color: '#059669'}]}],
            },
            {
                vertices:    explicit.heavy,
                allVertices: explicit.all,
                atomOrder,
            },
        );

        const label = svg.querySelector('.atom-value-overlay text');
        expect(label).not.toBeNull();

        // atomOrder maps atom_index 0 to target.vertices[atomOrder.indexOf(0)] = heavy[4].
        const nitrogen = explicit.heavy[4];
        expect(nitrogen.value.element).toBe('N');

        const placedX = Number(label.getAttribute('x'));
        const placedY = Number(label.getAttribute('y'));
        const distanceTo = (v) => Math.hypot(placedX - v.position.x, placedY - v.position.y);

        expect(distanceTo(nitrogen)).toBeGreaterThan(5);
        // If atomOrder were ignored (falling back to the identity mapping), atom_index 0
        // would incorrectly resolve to heavy[0] (an O) instead of the N - guard against
        // that regression by requiring the label read as unambiguously closer to N.
        expect(distanceTo(nitrogen)).toBeLessThan(distanceTo(explicit.heavy[0]));
    });
});

describe('AtomValueOverlay.fitViewBoxToBundle', () => {
    it('reserves the same space regardless of which dataset is later applied, or none', () => {
        const {all, heavy} = layout('c1ccccc1N', false);
        const target = {vertices: heavy, allVertices: all, atomOrder: null};
        const bundle = {
            atomOrder: null,
            datasets: {
                short: {label: 'short', entries: [{atom_index: 0, parts: [{text: '9'}]}]},
                long:  {label: 'long',  entries: [{atom_index: 6, parts: [{text: '123.45'}]}]},
            },
        };

        const svgReservedOnly = stubSvg('0 0 100 100');
        AtomValueOverlay.fitViewBoxToBundle(svgReservedOnly, bundle, target);
        const reserved = svgReservedOnly.getAttribute('viewBox');

        const svgShort = stubSvg('0 0 100 100');
        AtomValueOverlay.fitViewBoxToBundle(svgShort, bundle, target);
        AtomValueOverlay.apply(svgShort, bundle.datasets.short, target);
        expect(svgShort.getAttribute('viewBox')).toBe(reserved);

        const svgLong = stubSvg('0 0 100 100');
        AtomValueOverlay.fitViewBoxToBundle(svgLong, bundle, target);
        AtomValueOverlay.apply(svgLong, bundle.datasets.long, target);
        expect(svgLong.getAttribute('viewBox')).toBe(reserved);

        // Not trivially true because the stub box happened to already contain
        // everything: confirm fitViewBoxToBundle actually grew it.
        expect(reserved).not.toBe('0 0 100 100');
    });

    it('is a no-op for a bundle with no datasets', () => {
        const {all, heavy} = layout('CC', false);
        const target = {vertices: heavy, allVertices: all, atomOrder: null};
        const svg = stubSvg('0 0 100 100');

        AtomValueOverlay.fitViewBoxToBundle(svg, {atomOrder: null, datasets: {}}, target);
        expect(svg.getAttribute('viewBox')).toBe('0 0 100 100');

        AtomValueOverlay.fitViewBoxToBundle(svg, null, target);
        expect(svg.getAttribute('viewBox')).toBe('0 0 100 100');
    });
});

describe('AtomValueOverlay.buildTooltipRows', () => {
    it('returns one row per dataset with entries on the atom', () => {
        const bundle = AtomValueOverlay.parseAtomValueBundle({
            datasets: {
                a: {label: 'A', entries: [{atom_index: 1, parts: [{text: '1.0'}]}]},
                b: {label: 'B', entries: [{atom_index: 0, parts: [{text: '2.0'}]}]},
                c: {label: 'C', entries: [], error: 'failed'},
            },
        });

        const rows = AtomValueOverlay.buildTooltipRows(0, bundle);
        expect(rows).toHaveLength(2);
        expect(rows[0].label).toBe('B');
        expect(rows[0].parts[0].text).toBe('2.0');
        expect(rows[1].label).toBe('C');
        expect(rows[1].muted).toBe(true);
    });
});
