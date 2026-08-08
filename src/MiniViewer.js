// @ts-check
import SmiDrawer   from './SmilesDrawer.js';
import AtomTooltip from './AtomTooltip.js';
import {apply as applyAtomValues, fitViewBoxToBundle} from './AtomValueOverlay.js';

/** Compact presets: small canvas, no explicit hydrogens, tighter type. */
export const MINI_OPTIONS = {
    explicitHydrogens: false,
    width:             180,
    height:            140,
    padding:           6,
    bondLength:        20,
    fontSizeLarge:     9,
};

const FADE_MS       = 300;
const DIALOG_CLASS  = 'sd-mini-viewer-dialog';
const VISIBLE_CLASS = 'sd-visible';
const STYLE_ID      = 'sd-mini-viewer-style';

function heavyVertices(graph) {
    return graph.vertices.filter(v => v.value.element !== 'H');
}

/**
 * SvgDrawer never fills a background into the SVG itself (that's a CanvasWrapper-only
 * concern) - it's on the host to color the element behind it to match the theme. This
 * is that host, so `theme`'s BACKGROUND is resolved from the drawer's own merged
 * `opts.themes` (covers custom themes passed via `miniOptions`/`expandedOptions`, not
 * just the built-ins) and applied automatically.
 */
function themeBackground(theme, drawer) {
    return drawer.drawer.opts.themes[theme]?.BACKGROUND ?? null;
}

/** Bitwise-inverts a `#rrggbb` color, for a border that reads against any background. */
function invertHex(hex) {
    const match = /^#([0-9a-f]{6})$/i.exec(hex ?? '');
    if (!match) {
        return null;
    }
    return '#' + (0xffffff ^ parseInt(match[1], 16)).toString(16).padStart(6, '0');
}

/** rAF twice (falling back to a timer) so a CSS transition sees its `from` state painted first. */
function nextFrame(fn) {
    const raf = typeof window !== 'undefined' && window.requestAnimationFrame;
    if (raf) {
        raf(() => raf(fn));
    }
    else {
        setTimeout(fn, 16);
    }
}

/**
 * Injects the dialog's fade-in/out rules once per document. Not inline styles because
 * `::backdrop` (the dialog's native scrim) can only be targeted from a stylesheet.
 */
function ensureStyle() {
    if (document.getElementById(STYLE_ID)) {
        return;
    }
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        dialog.${DIALOG_CLASS} { opacity: 0; transition: opacity ${FADE_MS}ms ease; }
        dialog.${DIALOG_CLASS}.${VISIBLE_CLASS} { opacity: 1; }
        dialog.${DIALOG_CLASS}::backdrop { background: rgba(0, 0, 0, 0.5); opacity: 0; transition: opacity ${FADE_MS}ms ease; }
        dialog.${DIALOG_CLASS}.${VISIBLE_CLASS}::backdrop { opacity: 1; }
    `;
    document.head.appendChild(style);
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
     */
    constructor(container, options = {}) {
        this.container        = container;
        this.miniOptions      = options.miniOptions || {};
        this.expandedOptions  = options.expandedOptions || {};
        this.theme            = options.theme || 'light';
        this.values           = options.values ?? null;
        this.dataset          = options.dataset ?? null;
        this.showControls     = options.showControls ?? true;
        this.onRender         = options.onRender || null;
        this.onError          = options.onError || null;

        this.smiles  = null;
        this.dialog  = null;
        this.tooltip = null;

        // State for the enlarged dialog's own H/values toggles - independent of the
        // mini tile, which always draws compactly. Defaults mirror the playground's
        // standard viewer: H labels off, values on, first dataset selected.
        this._expandedShowAllH   = false;
        this._expandedShowValues = true;
        this._expandedDataset    = this.dataset ?? Object.keys(this.values?.datasets ?? {})[0] ?? null;

        Object.assign(this.container.style, {cursor: 'pointer'});
        this.container.setAttribute('role', 'button');
        this.container.setAttribute('tabindex', '0');
        this.container.setAttribute('aria-label', 'Enlarge structure');

        this._closing = false;

        this._onClick   = this._onClick.bind(this);
        this._onKeydown  = this._onKeydown.bind(this);
        this._onDialogClick  = this._onDialogClick.bind(this);
        this._onDialogClose  = this._onDialogClose.bind(this);
        this._onDialogCancel = this._onDialogCancel.bind(this);

        this.container.addEventListener('click', this._onClick);
        this.container.addEventListener('keydown', this._onKeydown);
    }

    /**
     * Draws (or redraws) `smiles` into the container at mini size.
     * @param {String} smiles
     */
    draw(smiles) {
        this.smiles = smiles;

        const drawer = new SmiDrawer({...MINI_OPTIONS, ...this.miniOptions});
        drawer.draw(smiles, 'svg', this.theme, svg => this._finish(svg, drawer), err => this._fail(err));
    }

    /**
     * Removes the dialog and listeners and empties the container. Safe to call more than once.
     */
    destroy() {
        this.container.removeEventListener('click', this._onClick);
        this.container.removeEventListener('keydown', this._onKeydown);
        this._closeDialog();
        if (this.dialog) {
            this.dialog.remove();
            this.dialog     = null;
            this.stage      = null;
            this.svgHolder  = null;
        }
        this._closing = false;
        this.container.replaceChildren();
    }

    _finish(svg, drawer) {
        const background = themeBackground(this.theme, drawer);
        if (background) {
            this.container.style.backgroundColor = background;
        }
        this.container.replaceChildren(svg);
        this._applyValues(svg, drawer, this.dataset);
        this.onRender?.(svg, {mode: 'mini', drawer});
    }

    _fail(err) {
        this.container.replaceChildren();
        this._reportError(err);
    }

    _reportError(err) {
        if (this.onError) {
            this.onError(err);
        }
        else {
            console.error(err);
        }
    }

    _applyValues(svg, drawer, datasetKey) {
        if (!this.values) {
            return;
        }
        const graph  = drawer.drawer.preprocessor.graph;
        const target = {vertices: heavyVertices(graph), allVertices: graph.vertices, atomOrder: this.values.atomOrder};
        const opts   = {atomFontSize: drawer.drawer.opts.fontSizeLarge};

        fitViewBoxToBundle(svg, this.values, target, opts);
        if (datasetKey && this.values.datasets[datasetKey]) {
            applyAtomValues(svg, this.values.datasets[datasetKey], target, opts);
        }
    }

    _onClick() {
        this.expand();
    }

    _onKeydown(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.expand();
        }
    }

    /** Opens the enlarged standard view in a modal `<dialog>`, building it on first use. */
    expand() {
        if (!this.smiles) {
            return;
        }

        if (!this.dialog) {
            ensureStyle();

            this.dialog = document.createElement('dialog');
            this.dialog.className = DIALOG_CLASS;
            // Border color is set per-draw (inverted from the theme background); the
            // width/style are fixed so only the color needs to change on redraw/retheme.
            Object.assign(this.dialog.style, {border: '3px solid transparent', borderRadius: '8px', padding: '16px'});
            this.dialog.addEventListener('click', this._onDialogClick);
            this.dialog.addEventListener('close', this._onDialogClose);
            this.dialog.addEventListener('cancel', this._onDialogCancel);

            // stage hosts the svg and docks the controls bar to its corner, same
            // relationship as playground's #output/#viewerControls.
            this.stage = document.createElement('div');
            Object.assign(this.stage.style, {position: 'relative'});
            this.svgHolder = document.createElement('div');
            this.stage.append(this.svgHolder);
            if (this.showControls) {
                this.stage.append(this._buildControls());
            }
            this.dialog.append(this.stage);

            document.body.appendChild(this.dialog);
        }

        this._drawExpanded();

        // ponytail: jsdom (as of v30) doesn't implement HTMLDialogElement - showModal
        // is a no-op there. Real browsers have supported it since 2022. The open check
        // guards showModal()'s InvalidStateError if expand() is re-entered mid fade-out.
        if (!this.dialog.open) {
            this.dialog.showModal?.();
        }
        this._closing = false;
        // this.dialog may be null by the time this fires - destroy() can run within the
        // one frame this is scheduled for (e.g. a fast unmount right after opening).
        nextFrame(() => this.dialog?.classList.add(VISIBLE_CLASS));
    }

    /** Fades the dialog out over FADE_MS, then actually closes it. Safe to call more than once. */
    _closeAnimated() {
        if (!this.dialog || this._closing) {
            return;
        }
        this._closing = true;
        this.dialog.classList.remove(VISIBLE_CLASS);

        const finish = () => {
            // Same guard as above: destroy() may have run during the fade-out.
            if (!this._closing || !this.dialog) {
                return;
            }
            this._closing = false;
            this.dialog.removeEventListener('transitionend', finish);
            // ponytail: jsdom (as of v30) doesn't implement close() either; the 'close'
            // event (and thus _closeDialog()'s tooltip teardown) simply won't fire there.
            this.dialog.close?.();
        };
        this.dialog.addEventListener('transitionend', finish);
        // Fallback in case transitionend doesn't fire (e.g. prefers-reduced-motion, or
        // jsdom, which never dispatches it at all).
        setTimeout(finish, FADE_MS + 50);
    }

    /** (Re)draws the enlarged view with the current H/values toggle state. */
    _drawExpanded() {
        const options = {...this.expandedOptions};
        if (this._expandedShowAllH) {
            options.showCarbons = 'all';
        }

        const drawer = new SmiDrawer(options);
        drawer.draw(this.smiles, 'svg', this.theme, (svg) => {
            const background = themeBackground(this.theme, drawer);
            if (background) {
                this.dialog.style.backgroundColor = background;
                this.dialog.style.borderColor = invertHex(background) ?? '#888888';
            }
            this.svgHolder.replaceChildren(svg);
            this._applyValues(svg, drawer, this._expandedShowValues ? this._expandedDataset : null);
            this.onRender?.(svg, {mode: 'expanded', drawer});

            if (this.tooltip) {
                this.tooltip.destroy();
            }
            this.tooltip = new AtomTooltip(svg, {container: this.stage, atomValueBundle: this.values});
            this.tooltip.attach();
        }, (err) => {
            this.svgHolder.replaceChildren();
            this._reportError(err);
        });
    }

    /** Builds the "Show all H" / values toggle bar docked to the stage's top-right corner. */
    _buildControls() {
        const bar = document.createElement('div');
        Object.assign(bar.style, {
            position:     'absolute',
            top:          '8px',
            right:        '8px',
            display:      'inline-flex',
            alignItems:   'center',
            gap:          '12px',
            background:   'rgba(255, 255, 255, 0.92)',
            border:       '1px solid #ccc',
            borderRadius: '999px',
            padding:      '4px 10px',
            font:         '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
            userSelect:   'none',
            whiteSpace:   'nowrap',
        });

        const hLabel    = MiniViewer._buildToggleLabel('Show all H', this._expandedShowAllH, (checked) => {
            this._expandedShowAllH = checked;
            this._drawExpanded();
        });
        bar.append(hLabel);

        const datasetKeys = this.values?.datasets ? Object.keys(this.values.datasets) : [];
        if (datasetKeys.length > 0) {
            const select = document.createElement('select');
            select.hidden = !this._expandedShowValues;
            for (const key of datasetKeys) {
                const option = document.createElement('option');
                option.value    = key;
                option.text     = this.values.datasets[key].label || key;
                option.selected = key === this._expandedDataset;
                select.append(option);
            }
            select.addEventListener('change', () => {
                this._expandedDataset = select.value;
                this._drawExpanded();
            });

            const vLabel = MiniViewer._buildToggleLabel('Show values', this._expandedShowValues, (checked) => {
                this._expandedShowValues = checked;
                select.hidden = !checked;
                this._drawExpanded();
            });
            bar.append(vLabel, select);
        }

        return bar;
    }

    static _buildToggleLabel(text, checked, onChange) {
        const label = document.createElement('label');
        Object.assign(label.style, {display: 'inline-flex', alignItems: 'center', gap: '6px'});

        const checkbox = document.createElement('input');
        checkbox.type    = 'checkbox';
        checkbox.checked = checked;
        checkbox.addEventListener('change', () => onChange(checkbox.checked));

        label.append(checkbox, document.createTextNode(text));
        return label;
    }

    _onDialogClick(event) {
        if (event.target === this.dialog) {
            this._closeAnimated();
        }
    }

    _onDialogCancel(event) {
        // Esc closes a <dialog> instantly by default; animate it out instead.
        event.preventDefault();
        this._closeAnimated();
    }

    _onDialogClose() {
        this._closeDialog();
    }

    _closeDialog() {
        if (this.tooltip) {
            this.tooltip.destroy();
            this.tooltip = null;
        }
    }
}
