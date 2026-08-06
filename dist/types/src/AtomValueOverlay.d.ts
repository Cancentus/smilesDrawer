/**
 * @param {string} provider
 * @returns {string}
 */
export function providerDisplayName(provider: string): string;
/**
 * @param {'acid'|'base'} role
 * @returns {string}
 */
export function pkaRoleColor(role: "acid" | "base"): string;
/**
 * Normalize AIDD pKa JSON into an AtomValueBundle.
 *
 * @param {object} json
 * @returns {AtomValueBundle}
 */
export function parsePkaDatasets(json: object): AtomValueBundle;
/**
 * Normalize generic or pKa JSON into an AtomValueBundle.
 *
 * @param {object} json
 * @returns {AtomValueBundle}
 */
export function parseAtomValueBundle(json: object): AtomValueBundle;
/**
 * Append atom-value labels to a freshly drawn structure SVG.
 *
 * @param {SVGSVGElement} svgEl
 * @param {AtomValueDataset|null|undefined} dataset
 * @param {AtomValueTarget} target
 * @param {{ defaultColor?: string, separatorColor?: string }} [options]
 * @returns {SVGSVGElement}
 */
export function apply(svgEl: SVGSVGElement, dataset: AtomValueDataset | null | undefined, target: AtomValueTarget, options?: {
    defaultColor?: string;
    separatorColor?: string;
}): SVGSVGElement;
/**
 * Build AtomTooltip extra rows for all datasets on one atom.
 *
 * @param {number} atomIdx
 * @param {AtomValueBundle|null|undefined} bundle
 * @returns {Array<[string, string, string?]|{ label: string, parts: AtomValuePart[] }|{ label: string, value: string, muted?: boolean }>}
 */
export function buildTooltipRows(atomIdx: number, bundle: AtomValueBundle | null | undefined): Array<[string, string, string?] | {
    label: string;
    parts: AtomValuePart[];
} | {
    label: string;
    value: string;
    muted?: boolean;
}>;
/**
 * CSS rules for host styling of overlay labels.
 *
 * @returns {string}
 */
export function overlayCss(): string;
declare namespace _default {
    export { apply };
    export { buildTooltipRows };
    export { overlayCss };
    export { parseAtomValueBundle };
    export { parsePkaDatasets };
    export { providerDisplayName };
    export { pkaRoleColor };
}
export default _default;
export type AtomValuePart = {
    text: string;
    color?: string;
    title?: string;
};
export type AtomValueEntry = {
    atom_index: number;
    parts: AtomValuePart[];
};
export type AtomValueDataset = {
    label: string;
    entries: AtomValueEntry[];
    error?: string;
};
export type AtomValueBundle = {
    atomOrder: number[] | null;
    datasets: Record<string, AtomValueDataset>;
};
export type AtomValueTarget = {
    vertices: object[];
    allVertices: object[];
    atomOrder: number[] | null;
};
