export namespace MINI_OPTIONS {
    let explicitHydrogens: boolean;
    let width: number;
    let height: number;
    let padding: number;
    let bondLength: number;
    let fontSizeLarge: number;
}
/**
 * A small, click-to-enlarge 2D structure viewer. Draws `smiles` at a compact size (no
 * explicit hydrogens) into `container`; clicking (or Enter/Space on) the container opens
 * the same structure at standard size in a modal `<dialog>`.
 *
 * Reuses SmiDrawer for drawing and AtomTooltip/AtomValueOverlay for the enlarged view's
 * hover info and value labels - this class only owns the two size presets and the dialog.
 */
export default class MiniViewer {
    static _buildToggleLabel(text: any, checked: any, onChange: any): HTMLLabelElement;
    /**
     * @param {HTMLElement} container Host element the mini SVG is drawn into. Its own
     *        sizing/border is left to the caller; this only sets cursor/role/tabindex.
     * @param {Object}   [options]
     * @param {Object}   [options.miniOptions]     Molecule options merged over MINI_OPTIONS.
     * @param {Object}   [options.expandedOptions] Molecule options for the enlarged dialog
     *        view (defaults to the library defaults, i.e. `{}`).
     * @param {String}   [options.theme='light']
     * @param {?import('./AtomValueOverlay.js').AtomValueBundle} [options.values]
     *        An atom-value bundle (see AtomValueOverlay.parseAtomValueBundle()), applied to
     *        both the mini and the enlarged view.
     * @param {?String}  [options.dataset] Which dataset key of `values` to label with.
     * @param {Boolean}  [options.showControls=true] Whether to build the expanded dialog's
     *        own "Show all H"/"Show values" bar. Set false when the host has its own H/values
     *        UI and wants the dialog to be just the enlarged structure.
     * @param {?Function}[options.onRender] `(svg, {mode, drawer}) => void`, called right
     *        after every draw (`mode` is `'mini'` or `'expanded'`), before the tooltip
     *        attaches. For host-specific post-processing (e.g. a bespoke value overlay)
     *        that doesn't fit the generic `values` bundle shape.
     * @param {?Function}[options.onError] `(err) => void`, called if drawing fails.
     * @param {Boolean}  [options.expandable=true] When false, skips all click/keyboard-open/
     *        dialog machinery and renders the expanded-style view (bigger size, full toggle
     *        bar per `showControls`) directly into `container`. For hosts that already have
     *        their own modal wrapping the structure (avoids nesting a dialog in a dialog).
     */
    constructor(container: HTMLElement, options?: {
        miniOptions?: any;
        expandedOptions?: any;
        theme?: string;
        values?: import("./AtomValueOverlay.js").AtomValueBundle | null;
        dataset?: string | null;
        showControls?: boolean;
        onRender?: Function | null;
        onError?: Function | null;
        expandable?: boolean;
    });
    container: HTMLElement;
    miniOptions: any;
    expandedOptions: any;
    theme: string;
    values: import("./AtomValueOverlay.js").AtomValueBundle;
    dataset: string;
    showControls: boolean;
    onRender: Function;
    onError: Function;
    expandable: boolean;
    smiles: string;
    dialog: HTMLDialogElement;
    tooltip: AtomTooltip;
    _expandedShowAllH: boolean;
    _expandedShowValues: boolean;
    _expandedDataset: string;
    _closing: boolean;
    _onClick(): void;
    _onKeydown(event: any): void;
    _onDialogClick(event: any): void;
    _onDialogClose(): void;
    _onDialogCancel(event: any): void;
    /**
     * Draws (or redraws) `smiles` into the container - at mini size and click-to-enlarge if
     * `expandable`, or as the expanded-style view directly otherwise.
     * @param {String} smiles
     */
    draw(smiles: string): void;
    /**
     * Removes the dialog and listeners and empties the container. Safe to call more than once.
     */
    destroy(): void;
    stage: HTMLDivElement;
    svgHolder: HTMLDivElement;
    _finish(svg: any, drawer: any): void;
    _fail(err: any): void;
    _reportError(err: any): void;
    _applyValues(svg: any, drawer: any, datasetKey: any): void;
    /** Opens the enlarged standard view in a modal `<dialog>`, building it on first use. */
    expand(): void;
    /** Fades the dialog out over FADE_MS, then actually closes it. Safe to call more than once. */
    _closeAnimated(): void;
    /**
     * Builds the inline stage (svg holder + optional controls) directly in `container`, for
     * `expandable: false`. Mirrors expand()'s one-time dialog-build block minus the dialog/
     * fade/backdrop parts. Unlike the dialog, which sizes to its content, this must fill the
     * host container so the host's own CSS on the SVG (e.g. max-height: 100%) has something
     * real to resolve against.
     */
    _ensureInlineStage(): void;
    /** (Re)draws the enlarged view with the current H/values toggle state. */
    _drawExpanded(): void;
    /** Builds the "Show all H" / values toggle bar docked to the stage's top-right corner. */
    _buildControls(): HTMLDivElement;
    _closeDialog(): void;
}
import AtomTooltip from './AtomTooltip.js';
