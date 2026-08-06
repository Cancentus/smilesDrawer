import {describe, it, expect} from 'vitest';

import Ring           from '../../src/Ring.js';
import RingConnection from '../../src/RingConnection.js';

function makeRing(id, members) {
    let ring = new Ring(members);
    ring.id = id;
    return ring;
}

function makeVertex(id, neighbours) {
    return {
        id,
        neighbours,
        value: {rings: []},
    };
}

function connection(firstRing, secondRing) {
    let rc = new RingConnection(firstRing, secondRing);
    rc.id = 0;
    return rc;
}

describe('flat arc fusion classification', () => {
    it('does not treat a small ring sharing a 3-atom arc with a large ring as a bridge', () => {
        // Large 20-member ring shares atoms 0-1-2 with a 5-member ring.
        let big = makeRing(0, Array.from({length: 20}, (_, i) => i));
        let small = makeRing(1, [0, 1, 2, 20, 21]);
        let rc = connection(big, small);

        let vertices = Array.from({length: 22}, (_, i) => makeVertex(i, []));
        vertices[0].neighbours = [1, 19];
        vertices[1].neighbours = [0, 2];
        vertices[2].neighbours = [1, 3];
        for (let i = 3; i < 19; i++) {
            vertices[i].neighbours = [i - 1, i + 1];
        }
        vertices[19].neighbours = [18, 0];
        vertices[20].neighbours = [2, 21];
        vertices[21].neighbours = [20, 0];

        let getRing = (id) => (id === 0 ? big : small);

        expect(rc.isBridge(vertices, getRing)).toBe(false);
    });

    it('still treats a same-size 4-atom bicyclo[2.2.2]octane arc as a bridge', () => {
        let ringA = makeRing(0, [0, 1, 2, 3, 7, 6]);
        let ringB = makeRing(1, [0, 1, 4, 5, 7, 6]);
        let rc = connection(ringA, ringB);

        let vertices = Array.from({length: 8}, (_, i) => makeVertex(i, []));
        vertices[0].neighbours = [1, 7];
        vertices[1].neighbours = [0, 2];
        vertices[2].neighbours = [1, 3];
        vertices[3].neighbours = [2, 7];
        vertices[4].neighbours = [5, 7];
        vertices[5].neighbours = [4, 6];
        vertices[6].neighbours = [5, 7];
        vertices[7].neighbours = [6, 0, 3, 4];

        let getRing = (id) => (id === 0 ? ringA : ringB);

        expect([...rc.vertices].sort()).toEqual([0, 1, 6, 7]);
        expect(rc.isBridge(vertices, getRing)).toBe(true);
    });

    it('still treats a non-contiguous 3-vertex shared set as a bridge', () => {
        let ringA = makeRing(0, [0, 1, 2, 3, 4, 5]);
        let ringB = makeRing(1, [0, 2, 4, 10, 11, 12]);
        let rc = connection(ringA, ringB);

        let vertices = Array.from({length: 13}, (_, i) => makeVertex(i, []));
        vertices[0].neighbours = [1, 5, 2, 4];
        vertices[1].neighbours = [0, 2];
        vertices[2].neighbours = [1, 3, 0, 4];
        vertices[3].neighbours = [2, 4];
        vertices[4].neighbours = [3, 5, 0, 2];
        vertices[5].neighbours = [4, 0];
        vertices[10].neighbours = [11, 4];
        vertices[11].neighbours = [10, 12];
        vertices[12].neighbours = [11, 2];

        let getRing = (id) => (id === 0 ? ringA : ringB);

        expect(RingConnection.orderContiguousPath(vertices, [0, 2, 4])).toBe(null);
        expect(rc.isBridge(vertices, getRing)).toBe(true);
    });

    it('orders a contiguous shared path in bond order', () => {
        let vertices = [
            makeVertex(0, [1]),
            makeVertex(1, [0, 2]),
            makeVertex(2, [1, 3]),
            makeVertex(3, [2]),
        ];

        expect(RingConnection.orderContiguousPath(vertices, [0, 1, 2, 3])).toEqual([0, 1, 2, 3]);
        expect(RingConnection.orderContiguousPath(vertices, [3, 2, 1, 0])).toEqual([3, 2, 1, 0]);
    });

    it('keeps porphyrin-like systems bridged when four small rings share arcs', () => {
        let big = makeRing(0, Array.from({length: 16}, (_, i) => i));
        let smallRings = [1, 2, 3, 4].map((id) => makeRing(id, [id * 10, id * 10 + 1, id * 10 + 2, 100 + id, 101 + id]));

        let vertices = Array.from({length: 120}, (_, i) => makeVertex(i, []));
        let getRing = (id) => (id === 0 ? big : smallRings[id - 1]);

        let ringConnections = smallRings.map((small) => {
            let rc = connection(big, small);
            rc.vertices = new Set([small.members[0], small.members[1], small.members[2]]);
            return rc;
        });

        for (let i = 0; i < 4; i++) {
            let a = smallRings[i].members[0];
            let b = smallRings[i].members[1];
            let c = smallRings[i].members[2];
            vertices[a].neighbours = [b];
            vertices[b].neighbours = [a, c];
            vertices[c].neighbours = [b];
        }

        for (let rc of ringConnections) {
            expect(RingConnection.flatArcPartnerCount(ringConnections, vertices, getRing, rc)).toBe(4);
            expect(rc.isBridge(vertices, getRing, ringConnections)).toBe(true);
        }
    });
});
