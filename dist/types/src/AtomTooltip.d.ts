/**
 * A hover tooltip for atoms in an SVG drawn by SvgDrawer/Drawer: a small semi-transparent
 * box docked to a corner of the container, showing the hovered atom's info - similar to
 * Mol*'s hover info box for 3D structures.
 *
 * Reads its data purely from the `data-*` attributes SvgWrapper.drawAtomHitTarget() stamps
 * onto each atom's (invisible) hit-target circle, so it works with any SVG this library
 * produces, as long as that SVG is live in the DOM (a detached/serialized SVG has nothing
 * to attach listeners to).
 */
export default class AtomTooltip {
    /**
     * @param {[string, string, string?]|{ label: string, parts?: object[], value?: string, muted?: boolean }} row
     * @returns {HTMLDivElement}
     */
    static _renderExtraRow(row: [string, string, string?] | {
        label: string;
        parts?: object[];
        value?: string;
        muted?: boolean;
    }): HTMLDivElement;
    /**
     * Formats the element+number label shown as the tooltip header (1-based numbering).
     *
     * @param {DOMStringMap} dataset
     * @returns {string}
     */
    static formatLabel(dataset: DOMStringMap): string;
    /**
     * Formats a hit-target's dataset into the tooltip's text content, one field per line,
     * omitting empty/default fields so the box stays compact.
     *
     * @param {DOMStringMap} dataset
     * @returns {string}
     */
    static formatInfo(dataset: DOMStringMap): string;
    /**
     * @param {SVGSVGElement} svg The SVG element drawn by SvgDrawer/Drawer, already in the DOM.
     * @param {Object}    [options]
     * @param {HTMLElement} [options.container] The positioning parent for the tooltip box.
     *        Defaults to `svg.parentElement`. If its `position` is `static`, it's switched
     *        to `relative` so the box can dock to a corner of it.
     * @param {'bottom-right'|'bottom-left'|'top-right'|'top-left'} [options.corner='bottom-right']
     * @param {Function}  [options.getExtra] `(dataset) => Array` of extra rows. Each row may be:
     *        - `[label, value, color?]` (legacy)
     *        - `{ label, parts: [{ text, color?, title? }, …] }` (multi-colored values)
     *        - `{ label, value, muted?: boolean }` (plain or error text)
     * @param {import('./AtomValueOverlay.js').AtomValueBundle|null} [options.atomValueBundle]
     *        When set, appends rows from all datasets for the hovered atom.
     */
    constructor(svg: SVGSVGElement, options?: {
        container?: HTMLElement;
        corner?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
        getExtra?: Function;
        atomValueBundle?: import("./AtomValueOverlay.js").AtomValueBundle | null;
    });
    svg: SVGSVGElement;
    container: HTMLElement;
    corner: "bottom-right" | "bottom-left" | "top-right" | "top-left";
    getExtra: Function;
    atomValueBundle: import("./AtomValueOverlay.js").AtomValueBundle;
    box: HTMLDivElement;
    hoveredId: any;
    _onPointerMove(event: any): void;
    _onPointerLeave(): void;
    /**
     * Creates the tooltip box and starts listening for hover on the SVG. No-op if already attached.
     */
    attach(): void;
    /**
     * Removes the tooltip box and stops listening. Safe to call more than once.
     */
    destroy(): void;
    _show(dataset: any): void;
    _hide(): void;
}
