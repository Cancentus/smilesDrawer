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
     * Order shared vertex ids into a contiguous bond path when they form one.
     * Returns null when the set is not a simple path (two endpoints, interior
     * degree-2).
     *
     * @param {Vertex[]} vertices The molecule vertices.
     * @param {Number[]} vertexIds Shared vertex ids.
     * @param {?Number} [startVertexId=null] Preferred start (must be an endpoint).
     * @returns {(Number[]|null)} Ordered path ids or null.
     */
    static orderContiguousPath(vertices: Vertex[], vertexIds: number[], startVertexId?: number | null): (number[] | null);
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
    static flatArcPartnerCount(ringConnections: RingConnection[], vertices: Vertex[], getRing: Function, ringConnection: RingConnection): number;
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
    static isBridge(ringConnections: RingConnection[], vertices: Vertex[], firstRingId: number, secondRingId: number, getRing?: any): boolean;
    /**
     * Retruns the neighbouring rings of a given ring.
     *
     * @static
     * @param {RingConnection[]} ringConnections An array of ring connections containing ring connections associated with the current molecule.
     * @param {Number} ringId A ring id.
     * @returns {Number[]} An array of ring ids of neighbouring rings.
     */
    static getNeighbours(ringConnections: RingConnection[], ringId: number): number[];
    /**
     * Returns an array of vertex ids associated with a given ring connection.
     *
     * @static
     * @param {RingConnection[]} ringConnections An array of ring connections containing ring connections associated with the current molecule.
     * @param {Number} firstRingId A ring id.
     * @param {Number} secondRingId A ring id.
     * @returns {Number[]} An array of vertex ids associated with the ring connection.
     */
    static getVertices(ringConnections: RingConnection[], firstRingId: number, secondRingId: number): number[];
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
    static getOrderedVertices(ringConnections: RingConnection[], vertices: Vertex[], firstRingId: number, secondRingId: number, startVertexId?: number | null): number[] | undefined;
    /**
     * The constructor for the class RingConnection.
     *
     * @param {Ring} firstRing A ring.
     * @param {Ring} secondRing A ring.
     */
    constructor(firstRing: Ring, secondRing: Ring);
    id: any;
    firstRingId: any;
    secondRingId: any;
    vertices: Set<any>;
    isForcedBridge: boolean;
    /**
     * Adding a vertex to the ring connection.
     *
     * @param {Number} vertexId A vertex id.
     */
    addVertex(vertexId: number): void;
    /**
     * Update the ring id of this ring connection that is not the ring id supplied as the second argument.
     *
     * @param {Number} ringId A ring id. The new ring id to be set.
     * @param {Number} otherRingId A ring id. The id that is NOT to be updated.
     */
    updateOther(ringId: number, otherRingId: number): void;
    /**
     * Returns a boolean indicating whether or not a ring with a given id is participating in this ring connection.
     *
     * @param {Number} ringId A ring id.
     * @returns {Boolean} A boolean indicating whether or not a ring with a given id participates in this ring connection.
     */
    containsRing(ringId: number): boolean;
    /**
     * True when two rings meet along a short contiguous arc and the larger ring
     * is much bigger than the smaller — flat fusion, not a 3D bridge.
     *
     * @param {Vertex[]} vertices The molecule vertices.
     * @param {Function} getRing `(ringId) => Ring`.
     * @returns {Boolean}
     */
    isFlatArcFusion(vertices: Vertex[], getRing: Function): boolean;
    /**
     * Checks whether or not this ring connection is a bridge in a bridged ring.
     *
     * @param {Vertex[]} vertices The array of vertices associated with the current molecule.
     * @param {Function|null} [getRing=null] `(ringId) => Ring` for flat-arc fusion checks.
     * @param {RingConnection[]|null} [ringConnections=null] All connections, for porphyrin detection.
     * @returns {Boolean} A boolean indicating whether or not this ring connection is a bridge.
     */
    isBridge(vertices: Vertex[], getRing?: Function | null, ringConnections?: RingConnection[] | null): boolean;
}
import Vertex from './Vertex';
import Ring from './Ring';
