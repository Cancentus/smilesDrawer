import {describe, it, expect} from 'vitest';
import {createJSDOM}          from '../helpers';

import DrawerBase     from '../../src/DrawerBase.js';
import Parser         from '../../src/Parser.js';
import Ring           from '../../src/Ring.js';
import RingConnection from '../../src/RingConnection.js';
import SvgDrawer      from '../../src/SvgDrawer.js';

function makeRing(id, members) {
    let ring = new Ring(members);
    ring.id = id;
    return ring;
}

function makeDrawer(ringMembers, edgePairs) {
    let drawer = new DrawerBase({});
    drawer.rings = ringMembers.map((members, index) => makeRing(index, members));
    drawer.ringConnections = [];
    drawer.graph = {
        edges: edgePairs.map(([sourceId, targetId]) => ({sourceId, targetId})),
    };

    for (let i = 0; i < drawer.rings.length - 1; i++) {
        for (let j = i + 1; j < drawer.rings.length; j++) {
            let ringConnection = new RingConnection(drawer.rings[i], drawer.rings[j]);
            if (ringConnection.vertices.size > 0) {
                drawer.ringConnections.push(ringConnection);
            }
        }
    }

    return drawer;
}

function makeSquareGridDrawer() {
    let rings = [];
    let edges = [];
    let vertexId = (x, y) => y * 4 + x;

    for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
            rings.push([
                vertexId(x, y),
                vertexId(x + 1, y),
                vertexId(x + 1, y + 1),
                vertexId(x, y + 1),
            ]);
        }
    }

    for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 3; x++) {
            edges.push([vertexId(x, y), vertexId(x + 1, y)]);
        }
    }

    for (let x = 0; x < 4; x++) {
        for (let y = 0; y < 3; y++) {
            edges.push([vertexId(x, y), vertexId(x, y + 1)]);
        }
    }

    return makeDrawer(rings, edges);
}

describe('cage ring system detection', () => {
    it('forces fused cube faces to use bridged-ring layout', () => {
        let drawer = makeDrawer(
            [
                [4, 5, 6, 7],
                [0, 1, 2, 3],
                [0, 1, 5, 4],
                [3, 2, 6, 7],
                [0, 3, 7, 4],
            ],
            [
                [0, 1], [1, 2], [2, 3], [3, 0],
                [4, 5], [5, 6], [6, 7], [7, 4],
                [0, 4], [1, 5], [2, 6], [3, 7],
            ]
        );

        drawer.markCageRingSystems();

        expect(drawer.ringConnections.some(rc => rc.isForcedBridge)).toBe(true);
        expect(drawer.ringConnections.every(rc => rc.vertices.size < 2 || rc.isForcedBridge)).toBe(true);
    });

    it('does not force a flat fused ring grid', () => {
        let drawer = makeSquareGridDrawer();

        drawer.markCageRingSystems();

        expect(drawer.ringConnections.every(rc => !rc.isForcedBridge)).toBe(true);
    });
});

/**
 * initRings() perceives relevant cycles rather than the SSSR, so that the faces
 * an arbitrary minimum cycle basis drops on a symmetric cage are available to
 * the bridged-ring layout. Reverting to SSSR.getRings() would show up here as a
 * ring count one short on every cage.
 */
describe('cage ring perception', () => {
    function ringCount(smiles) {
        const dom = createJSDOM();
        const svg = dom.window.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        dom.window.document.body.appendChild(svg);

        const drawer = new SvgDrawer({isomeric: true});
        drawer.draw(Parser.parse(smiles), svg, 'light');

        return drawer.preprocessor.getRingCount();
    }

    const cases = [
        ['cubane',               'C12C3C4C1C5C4C3C25',        6],  // SSSR gives 5
        ['bicyclo[2.2.2]octane', 'C1CC2CCC1CC2',              3],  // SSSR gives 2
        ['adamantane',           'C1C2CC3CC1CC(C2)C3',        4],  // SSSR gives 3
    ];

    for (const [name, smiles, expected] of cases) {
        it(`perceives every face of ${name}`, () => {
            expect(ringCount(smiles)).toBe(expected);
        });
    }

    // Where the minimum cycle basis is already unique, the two agree.
    const unchanged = [
        ['benzene',     'c1ccccc1',        1],
        ['naphthalene', 'c1ccc2ccccc2c1',  2],
        ['norbornane',  'C1CC2CCC1C2',     2],
    ];

    for (const [name, smiles, expected] of unchanged) {
        it(`leaves ${name} unchanged`, () => {
            expect(ringCount(smiles)).toBe(expected);
        });
    }
});
