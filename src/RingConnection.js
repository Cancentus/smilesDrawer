// @ts-check
import Ring   from './Ring';
import Vertex from './Vertex';

/**
 * A class representing a ring connection.
 *
 * @property {Number} id The id of this ring connection.
 * @property {Number} firstRingId A ring id.
 * @property {Number} secondRingId A ring id.
 * @property {Set<Number>} vertices A set containing the vertex ids participating in the ring connection.
 */
export default class RingConnection {
    /**
     * The constructor for the class RingConnection.
     *
     * @param {Ring} firstRing A ring.
     * @param {Ring} secondRing A ring.
     */
    constructor(firstRing, secondRing) {
        this.id = null;
        this.firstRingId = firstRing.id;
        this.secondRingId = secondRing.id;
        this.vertices = new Set();
        this.isForcedBridge = false;

        for (let m = 0; m < firstRing.members.length; m++) {
            let c = firstRing.members[m];

            for (let n = 0; n < secondRing.members.length; n++) {
                let d = secondRing.members[n];

                if (c === d) {
                    this.addVertex(c);
                }
            }
        }
    }

    /**
     * Adding a vertex to the ring connection.
     *
     * @param {Number} vertexId A vertex id.
     */
    addVertex(vertexId) {
        this.vertices.add(vertexId);
    }

    /**
     * Update the ring id of this ring connection that is not the ring id supplied as the second argument.
     *
     * @param {Number} ringId A ring id. The new ring id to be set.
     * @param {Number} otherRingId A ring id. The id that is NOT to be updated.
     */
    updateOther(ringId, otherRingId) {
        if (this.firstRingId === otherRingId) {
            this.secondRingId = ringId;
        }
        else {
            this.firstRingId = ringId;
        }
    }

    /**
     * Returns a boolean indicating whether or not a ring with a given id is participating in this ring connection.
     *
     * @param {Number} ringId A ring id.
     * @returns {Boolean} A boolean indicating whether or not a ring with a given id participates in this ring connection.
     */
    containsRing(ringId) {
        return this.firstRingId === ringId || this.secondRingId === ringId;
    }

    /**
     * Order shared vertex ids into a contiguous bond path when they form one.
     * Returns null when the set is not a simple path (two endpoints, interior
     * degree-2).
     *
     * @param {Vertex[]} vertices The molecule vertices.
     * @param {Number[]} vertexIds Shared vertex ids.
     * @param {?Number} [startVertexId=null] Preferred start (must be an endpoint).
     * @returns {(Number[]|null)} Ordered path ids or null.
     */
    static orderContiguousPath(vertices, vertexIds, startVertexId = null) {
        if (vertexIds.length < 2) {
            return vertexIds.slice();
        }

        let vertexSet = new Set(vertexIds);
        let adjacency = new Map();

        for (let i = 0; i < vertexIds.length; i++) {
            let id = vertexIds[i];
            let neighbours = vertices[id].neighbours.filter(neighbourId => vertexSet.has(neighbourId));
            adjacency.set(id, neighbours);

            if (neighbours.length !== 1 && neighbours.length !== 2) {
                return null;
            }
        }

        let endpoints = vertexIds.filter(id => adjacency.get(id).length === 1);

        if (endpoints.length !== 2) {
            return null;
        }

        let start = startVertexId !== null && vertexSet.has(startVertexId)
            ? startVertexId
            : endpoints[0];

        if (adjacency.get(start).length !== 1 && adjacency.get(start).length !== 2) {
            return null;
        }

        let ordered = [start];
        let previous = null;
        let current = start;

        while (ordered.length < vertexIds.length) {
            let neighbours = adjacency.get(current).filter(neighbourId => neighbourId !== previous);

            if (neighbours.length === 0) {
                return null;
            }

            let next = neighbours[0];
            ordered.push(next);
            previous = current;
            current = next;
        }

        return ordered;
    }

    /**
     * True when two rings meet along a short contiguous arc and the larger ring
     * is much bigger than the smaller — flat fusion, not a 3D bridge.
     *
     * @param {Vertex[]} vertices The molecule vertices.
     * @param {Function} getRing `(ringId) => Ring`.
     * @returns {Boolean}
     */
    isFlatArcFusion(vertices, getRing) {
        if (this.vertices.size <= 2 || getRing === null) {
            return false;
        }

        let shared = [...this.vertices];
        let ordered = RingConnection.orderContiguousPath(vertices, shared);

        if (ordered === null) {
            return false;
        }

        let ringA = getRing(this.firstRingId);
        let ringB = getRing(this.secondRingId);

        if (ringA === null || ringB === null) {
            return false;
        }

        let sizeA = ringA.getSize();
        let sizeB = ringB.getSize();
        let bigger = Math.max(sizeA, sizeB);
        let smaller = Math.min(sizeA, sizeB);
        let arcLength = ordered.length;

        return (bigger - arcLength) >= smaller;
    }

    /**
     * How many 3+ atom connections on the larger ring of this pair qualify as
     * flat-arc fusion. Porphyrin-like systems (four pyrroles on one macrocycle)
     * hit >= 3 and must stay on bridged-ring layout.
     *
     * @param {RingConnection[]} ringConnections
     * @param {Vertex[]} vertices
     * @param {Function} getRing
     * @param {RingConnection} ringConnection
     * @returns {Number}
     */
    static flatArcPartnerCount(ringConnections, vertices, getRing, ringConnection) {
        let ringA = getRing(ringConnection.firstRingId);
        let ringB = getRing(ringConnection.secondRingId);

        if (ringA === null || ringB === null) {
            return 0;
        }

        let biggerRingId = ringA.getSize() >= ringB.getSize()
            ? ringConnection.firstRingId
            : ringConnection.secondRingId;

        let count = 0;

        for (let i = 0; i < ringConnections.length; i++) {
            let rc = ringConnections[i];

            if (!rc.containsRing(biggerRingId) || rc.vertices.size <= 2) {
                continue;
            }

            if (rc.isFlatArcFusion(vertices, getRing)) {
                count++;
            }
        }

        return count;
    }

    /**
     * Checks whether or not this ring connection is a bridge in a bridged ring.
     *
     * @param {Vertex[]} vertices The array of vertices associated with the current molecule.
     * @param {Function|null} [getRing=null] `(ringId) => Ring` for flat-arc fusion checks.
     * @param {RingConnection[]|null} [ringConnections=null] All connections, for porphyrin detection.
     * @returns {Boolean} A boolean indicating whether or not this ring connection is a bridge.
     */
    isBridge(vertices, getRing = null, ringConnections = null) {
        if (this.isForcedBridge) {
            return true;
        }

        if (this.vertices.size > 2) {
            if (this.isFlatArcFusion(vertices, getRing)) {
                if (ringConnections !== null
                    && RingConnection.flatArcPartnerCount(ringConnections, vertices, getRing, this) >= 3) {
                    return true;
                }

                return false;
            }

            return true;
        }

        // For 2 shared atoms, check if they form a triangle with a common
        // neighbor that's in one of the two rings. This detects bridged
        // bicyclic systems (e.g. norbornane, oxanorbornane) where SSSR
        // produces a small ring and a large ring sharing 2 bridgehead atoms.
        if (this.vertices.size === 2) {
            let [v1, v2] = [...this.vertices];
            let v2NeighbourSet = new Set(vertices[v2].neighbours);

            for (let n of vertices[v1].neighbours) {
                if (n !== v2 && v2NeighbourSet.has(n)) {
                    let nRings = vertices[n].value.rings;
                    if (nRings.includes(this.firstRingId) || nRings.includes(this.secondRingId)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    /**
     * Checks whether or not two rings are connected by a bridged bond.
     *
     * @static
     * @param {RingConnection[]} ringConnections An array of ring connections containing the ring connections associated with the current molecule.
     * @param {Vertex[]} vertices An array of vertices containing the vertices associated with the current molecule.
     * @param {Number} firstRingId A ring id.
     * @param {Number} secondRingId A ring id.
     * @returns {Boolean} A boolean indicating whether or not two rings ar connected by a bridged bond.
     */
    static isBridge(ringConnections, vertices, firstRingId, secondRingId, getRing = null) {
        let ringConnection = null;

        for (let i = 0; i < ringConnections.length; i++) {
            ringConnection = ringConnections[i];

            if ((ringConnection.firstRingId === firstRingId && ringConnection.secondRingId === secondRingId)
                || (ringConnection.firstRingId === secondRingId && ringConnection.secondRingId === firstRingId)
            ) {
                return ringConnection.isBridge(vertices, getRing, ringConnections);
            }
        }

        return false;
    }

    /**
     * Retruns the neighbouring rings of a given ring.
     *
     * @static
     * @param {RingConnection[]} ringConnections An array of ring connections containing ring connections associated with the current molecule.
     * @param {Number} ringId A ring id.
     * @returns {Number[]} An array of ring ids of neighbouring rings.
     */
    static getNeighbours(ringConnections, ringId) {
        let neighbours = [];

        for (let i = 0; i < ringConnections.length; i++) {
            let ringConnection = ringConnections[i];

            if (ringConnection.firstRingId === ringId) {
                neighbours.push(ringConnection.secondRingId);
            }
            else if (ringConnection.secondRingId === ringId) {
                neighbours.push(ringConnection.firstRingId);
            }
        }

        return neighbours;
    }

    /**
     * Returns an array of vertex ids associated with a given ring connection.
     *
     * @static
     * @param {RingConnection[]} ringConnections An array of ring connections containing ring connections associated with the current molecule.
     * @param {Number} firstRingId A ring id.
     * @param {Number} secondRingId A ring id.
     * @returns {Number[]} An array of vertex ids associated with the ring connection.
     */
    static getVertices(ringConnections, firstRingId, secondRingId) {
        for (let i = 0; i < ringConnections.length; i++) {
            let ringConnection = ringConnections[i];
            if ((ringConnection.firstRingId === firstRingId && ringConnection.secondRingId === secondRingId)
                || (ringConnection.firstRingId === secondRingId && ringConnection.secondRingId === firstRingId)
            ) {
                return [...ringConnection.vertices];
            }
        }
    }

    /**
     * Shared vertices between two rings, ordered along the bond path when contiguous.
     *
     * @param {RingConnection[]} ringConnections
     * @param {Vertex[]} vertices
     * @param {Number} firstRingId
     * @param {Number} secondRingId
     * @param {?Number} [startVertexId=null]
     * @returns {Number[]|undefined}
     */
    static getOrderedVertices(ringConnections, vertices, firstRingId, secondRingId, startVertexId = null) {
        let ids = RingConnection.getVertices(ringConnections, firstRingId, secondRingId);

        if (ids === undefined) {
            return undefined;
        }

        return RingConnection.orderContiguousPath(vertices, ids, startVertexId) || ids;
    }
}
