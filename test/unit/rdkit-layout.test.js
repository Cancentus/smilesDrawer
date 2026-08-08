/**
 * Tests for RdkitLayout.js - computing a smilesDrawer preset layout (see
 * DrawerBase.applyPresetLayout()) from a SMILES string via a @rdkit/rdkit
 * module, instead of decimer's precomputed layout.json.
 */
import {describe, it, expect, vi} from 'vitest';
import {createJSDOM}              from '../helpers';

import {layoutFromSmiles, setRdkit} from '../../src/RdkitLayout.js';
import SmilesDrawer                 from '../../src/SmilesDrawer.js';

// Builds a V2000 atom line with element/x/y in the exact fixed-width columns
// molblockToLayout() reads (x: 0-10, y: 10-20, z: 20-30, element: 31-34) -
// not whitespace-separated, so this must not rely on split(' ').
function atomLine(element, x, y) {
    const field = (n) => n.toFixed(4).padStart(10);
    return field(x) + field(y) + field(0) + ' ' + element.padEnd(3) + '0  0  0  0  0  0  0  0  0  0  0  0';
}

// Builds a V2000 bond line. Atom numbers are 1-based, 3-char fixed-width
// fields with no separator - abutting at >=100 (e.g. "100101").
function bondLine(atom1, atom2, bondType = 1) {
    const field = (n) => String(n).padStart(3);
    return field(atom1) + field(atom2) + field(bondType) + field(0);
}

function molblock(atomLines, bondLines, countsLine = null) {
    const counts = countsLine ?? (
        String(atomLines.length).padStart(3) + String(bondLines.length).padStart(3) + '  0  0  0  0  0  0  0  0999 V2000'
    );
    return [
        '',
        '     RDKit          2D',
        '',
        counts,
        ...atomLines,
        ...bondLines,
        'M  END',
    ].join('\n');
}

// A stub @rdkit/rdkit module: get_mol() returns a stub JSMol whose
// get_new_coords() always returns the given molblock.
function stubRdkit(mb, {molIsNull = false} = {}) {
    return {
        get_mol: vi.fn(() => molIsNull ? null : {
            get_new_coords: vi.fn(() => mb),
            delete:         vi.fn(),
        }),
    };
}

describe('layoutFromSmiles (molblock parsing, no real RDKit)', () => {
    it('parses atom elements/coordinates and 0-based bond indices, flipping y', () => {
        const mb = molblock(
            [atomLine('C', 0, 0.5), atomLine('C', 1, 0.5), atomLine('O', 1, 1.5)],
            [bondLine(1, 2), bondLine(2, 3)],
        );

        const layout = layoutFromSmiles('CCO', stubRdkit(mb));

        expect(layout.smiles).toBe('CCO');
        expect(layout.atoms).toEqual([
            {atom_index: 0, element: 'C', x: 0, y: -0.5},
            {atom_index: 1, element: 'C', x: 1, y: -0.5},
            {atom_index: 2, element: 'O', x: 1, y: -1.5},
        ]);
        expect(layout.bonds).toEqual([
            {begin_atom_index: 0, end_atom_index: 1},
            {begin_atom_index: 1, end_atom_index: 2},
        ]);
    });

    it('parses fixed-width bond lines correctly when atom numbers reach 3 digits', () => {
        // 101 atoms so a bond between the last two (100, 101) has abutting,
        // unseparated 3-digit fields in the molblock ("100101  1  0").
        const atomLines = Array.from({length: 101}, (_, i) => atomLine('C', i, 0));
        const mb = molblock(atomLines, [bondLine(100, 101)]);

        const layout = layoutFromSmiles('C', stubRdkit(mb));

        expect(layout.atoms).toHaveLength(101);
        expect(layout.bonds).toEqual([{begin_atom_index: 99, end_atom_index: 100}]);
    });

    it('returns null when the counts line cannot be parsed (e.g. "***" for >999 atoms)', () => {
        const mb = molblock([], [], '***' + '***' + '  0  0  0  0  0  0  0  0999 V2000');

        expect(layoutFromSmiles('C', stubRdkit(mb))).toBeNull();
    });

    it('returns null when get_mol() fails to parse the SMILES', () => {
        expect(layoutFromSmiles('not a smiles', stubRdkit('', {molIsNull: true}))).toBeNull();
    });

    it('returns null when no rdkit module is registered or passed', () => {
        expect(layoutFromSmiles('CCO')).toBeNull();
    });
});

// Only run against the real WASM module if it's actually installed/loadable -
// keeps this suite from failing in environments where the (dev-only)
// @rdkit/rdkit binary can't load.
let rdkit = null;
try {
    const initRDKitModule = (await import('@rdkit/rdkit')).default;
    rdkit = await initRDKitModule();
}
catch {
    // Left null; the describe block below is skipped.
}

describe.skipIf(!rdkit)('layoutFromSmiles (real @rdkit/rdkit)', () => {
    it('lays out benzene as a regular hexagon', () => {
        const layout = layoutFromSmiles('c1ccccc1', rdkit);

        expect(layout.atoms).toHaveLength(6);
        expect(layout.bonds).toHaveLength(6);

        const centroid = layout.atoms.reduce(
            (sum, a) => ({x: sum.x + a.x / 6, y: sum.y + a.y / 6}),
            {x: 0, y: 0},
        );
        const distances = layout.atoms.map((a) => Math.hypot(a.x - centroid.x, a.y - centroid.y));
        for (const d of distances) {
            expect(d).toBeCloseTo(distances[0], 2);
        }
    }, 20000);

    it('is accepted by applyPresetLayout() when drawn through SmiDrawer', () => {
        createJSDOM();
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        setRdkit(rdkit);
        try {
            const smilesDrawer = new SmilesDrawer();
            let drawnSvg = null;
            smilesDrawer.drawMolecule('c1ccccc1', 'svg', 'light', false, (svg) => {
                drawnSvg = svg;
            });

            expect(drawnSvg).not.toBeNull();
            expect(warnSpy).not.toHaveBeenCalled();
        }
        finally {
            setRdkit(null);
            warnSpy.mockRestore();
        }
    }, 20000);
});
