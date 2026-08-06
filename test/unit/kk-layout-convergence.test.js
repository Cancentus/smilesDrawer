/**
 * Kamada-Kawai has to actually converge, not just run out of iterations.
 *
 * KK only finds a local minimum, so the starting positions decide the outcome.
 * When a seed is wrong for a ring system, the loop in Graph.kkLayout() exits on
 * the iteration cap with an energy millions of times over the threshold, and
 * those unrelaxed coordinates get drawn: bonds at wildly different lengths,
 * aromatic rings that are not polygons, bonds crossing everywhere.
 *
 * The geometric bounds in test/complex/complex.test.js only catch that
 * indirectly - a capped-out layout can still squeak inside them while looking
 * like a tangle. This asserts the real property instead.
 */
import {describe, it, expect} from 'vitest';
import {createJSDOM}          from '../helpers';

import Graph     from '../../src/Graph.js';
import Parser    from '../../src/Parser.js';
import SvgDrawer from '../../src/SvgDrawer.js';

/**
 * Draws a SMILES and returns the energy every top-level kkLayout() call ended
 * at. Calls made by the seed retry pass an explicit seedStrategy and are left
 * out - only the energy the ring system finally settles at matters.
 *
 * @param {String} smiles
 * @returns {Number[]}
 */
function layoutEnergies(smiles) {
    const energies = [];
    const original = Graph.prototype.kkLayout;

    Graph.prototype.kkLayout = function (...args) {
        const energy = original.apply(this, args);

        if (args[10] === undefined || args[10] === null) {
            energies.push(energy);
        }

        return energy;
    };

    try {
        const dom = createJSDOM();
        const svg = dom.window.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        dom.window.document.body.appendChild(svg);
        new SvgDrawer({isomeric: true}).draw(Parser.parse(smiles), svg, 'light');
    }
    finally {
        Graph.prototype.kkLayout = original;
    }

    return energies;
}

// Molecules that still route through Kamada-Kawai for at least one bridged ring
// system. Flat-arc macrocycle fusions are tested separately below.
const molecules = {
    taxol:         'CC1=C2[C@@H](C(=O)[C@@]3([C@H](C[C@@H]4[C@]([C@H]3[C@@H]([C@@](C2(C)C)(C[C@@H]1OC(=O)[C@@H]([C@H](C1=CC=CC=C1)NC(=O)C1=CC=CC=C1)O)O)OC(=O)C1=CC=CC=C1)(CO4)OC(=O)C)O)C)OC(=O)C',
    morphine:      'CN1CC[C@]23[C@@H]4[C@H]1C[C@@H]5[C@@H]2[C@H](CC[C@H]4O)OC3=C(C=C5)O',
    dodecahedrane: 'C3%11C2C1C%10C8C6C1C5C2C4C3C9C7C4C5C6C7C8C9C%10%11',
    norbornane:    'C1CC2CCC1C2',
    adamantane:    'C1C2CC3CC1CC(C2)C3',
};

const flatArcMacrocycles = {
    'macrocyclic-kinase-inhibitor': 'CC1=CC5=C(C(=N1)OC)C2=CC(=N[N]2)NC3=CN=C(C(=N3)N[C@@H]4CCCNC4NCO5)C#N',
    rapamycin:                      'C[C@@H]1CC[C@H]2C[C@H](/C(=C/C=C/C=C/[C@H](C[C@H](C(=O)[C@@H]([C@@H](/C(=C/[C@H](C(=O)C[C@H](OC(=O)[C@@H]3CCCCN3C(=O)C(=O)[C@@]1(O)O2)[C@H](C)C[C@@H]1CC[C@H](O)[C@@H](OC)C1)C)/C)O)OC)C)C)/C)OC',
};

describe('Kamada-Kawai convergence', () => {
    // The default in DrawerBase.defaultOptions, which is what draw() uses.
    const kkThreshold = 0.1;

    for (const [name, smiles] of Object.entries(molecules)) {
        it(`relaxes every bridged ring system in ${name}`, () => {
            const energies = layoutEnergies(smiles);

            expect(energies.length).toBeGreaterThan(0);

            for (const energy of energies) {
                expect(energy).toBeLessThanOrEqual(kkThreshold);
            }
        });
    }

    it('leaves molecules without a bridged ring system alone', () => {
        expect(layoutEnergies('c1ccc2ccccc2c1')).toEqual([]);

        for (const smiles of Object.values(flatArcMacrocycles)) {
            expect(layoutEnergies(smiles)).toEqual([]);
        }
    });
});
