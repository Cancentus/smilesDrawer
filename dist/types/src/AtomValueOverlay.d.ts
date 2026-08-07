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
 * @param {{ defaultColor?: string, separatorColor?: string, atomFontSize?: number }} [options]
 *        `atomFontSize` is the drawer's `opts.fontSizeLarge`, in pt.
 * @returns {SVGSVGElement}
 */
export function apply(svgEl: SVGSVGElement, dataset: AtomValueDataset | null | undefined, target: AtomValueTarget, options?: {
    defaultColor?: string;
    separatorColor?: string;
    atomFontSize?: number;
}): SVGSVGElement;
/**
 * Grow the SVG's viewBox once to fit the largest label any dataset in this bundle
 * could need, so later toggling which dataset `apply()` draws never changes the
 * viewBox. Call whenever a bundle is loaded/drawn, regardless of which dataset (if
 * any) is currently shown; safe to call before or after `apply()`, and safe to call
 * with an empty/errored bundle (no-op). Must run after the structure's own viewBox
 * has been set (i.e. after draw() completes) - same precondition `apply()` already has.
 *
 * @param {SVGSVGElement} svgEl
 * @param {AtomValueBundle|null|undefined} bundle
 * @param {AtomValueTarget} target
 * @param {{ atomFontSize?: number }} [options]
 * @returns {SVGSVGElement}
 */
export function fitViewBoxToBundle(svgEl: SVGSVGElement, bundle: AtomValueBundle | null | undefined, target: AtomValueTarget, options?: {
    atomFontSize?: number;
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
    export { fitViewBoxToBundle };
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
