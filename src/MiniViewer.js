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

const FADE_MS        = 300;
const DIALOG_CLASS   = 'sd-mini-viewer-dialog';
const VISIBLE_CLASS  = 'sd-visible';
const STYLE_ID       = 'sd-mini-viewer-style';
const CONTROLS_CLASS = 'sd-mini-viewer-controls';
const RAIL_CLASS     = 'sd-mini-viewer-rail';

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

/** Perceived luminance (0..1) of a `#rrggbb` color, or `null` when it isn't one (e.g. `'transparent'`). */
function hexLuminance(hex) {
    const match = /^#([0-9a-f]{6})$/i.exec(hex ?? '');
    if (!match) {
        return null;
    }
    const n = parseInt(match[1], 16);
    const r = (n >> 16) & 0xff;
    const g = (n >> 8) & 0xff;
    const b = n & 0xff;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/**
 * The {background, borderColor, color, colorScheme} a chrome element (the expanded
 * view's controls bar, or the mini tile's rail) should use to read against a resolved
 * theme `background`. `null` means a transparent surface (the host owns it), so the
 * result follows it via `currentColor`/`inherit` instead of picking its own colors.
 */
function chromeStyle(background) {
    const luminance = hexLuminance(background);
    if (luminance === null) {
        return {background: 'transparent', borderColor: 'currentColor', color: 'inherit', colorScheme: ''};
    }
    if (luminance < 0.5) {
        return {
            background:  'rgba(255, 255, 255, 0.10)',
            borderColor: 'rgba(255, 255, 255, 0.28)',
            color:       '#ededed',
            colorScheme: 'dark',
        };
    }
    return {
        background:  'rgba(255, 255, 255, 0.92)',
        borderColor: '#ccc',
        color:       '#111111',
        colorScheme: 'light',
    };
}

/**
 * A rail button's glyph: a bold letter sized to read like one of Mol*'s icons.
 *
 * 18px is chosen against Mol*'s *ink*, not its icon box: its icon <svg> is 16.8px
 * (`font-size: 1.2em` of a 14px root, with `width/height: 1em` resolving against that same
 * 1.2em), but the Material paths inside only span 18-20 of their 24 viewBox units, so the
 * visible mark is ~12.6-14px. A cap height of ~0.71em puts 18px in the middle of that band.
 *
 * Deliberately plain HTML rather than an SVG <text> in a viewBox: user units would then be
 * scaled by the viewBox -> box ratio, so the font-size in this code wouldn't be the size
 * that renders. The rail button is already a centering flex container, so this needs no
 * baseline correction (which is all Mol*'s own `margin-bottom: 3px` on the svg is for).
 *
 * Set as longhands, not the `font` shorthand: `inherit` is not a valid <font-family>, so a
 * `font: 700 18px/1 inherit` shorthand is invalid and dropped whole - silently leaving the
 * glyph at whatever size it inherited. Longhands also leave `font-family` alone, which is
 * the inheritance that shorthand was reaching for in the first place.
 */
function buildRailIcon(glyph) {
    const span = document.createElement('span');
    span.setAttribute('aria-hidden', 'true');
    Object.assign(span.style, {fontWeight: '700', fontSize: '18px', lineHeight: '1'});
    span.textContent = glyph;
    return span;
}

function hydrogenTitle(showAllH) {
    return showAllH ? 'Hide all hydrogens' : 'Show all hydrogens';
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
        dialog.${DIALOG_CLASS} {
            /* A modal dialog is centered by the UA stylesheet's own \`dialog { margin: auto }\`
               working against \`inset: 0\` - but Tailwind (and other resets) zero \`margin\` on
               \`*\` as an author-origin rule, which beats the UA origin regardless of specificity.
               Restated here to win that fight and keep the dialog centered. */
            margin: auto;
            /* \`pointer-events\` is inherited, not reset by native showModal()'s top-layer
               promotion - it still cascades down from this dialog's DOM parent (body). Host
               modal frameworks (Radix, reka-ui, etc.) commonly set \`body { pointer-events:
               none }\` while their own modal is open, which would otherwise make every click
               in here fall straight through to whatever's behind it. */
            pointer-events: auto;
            opacity: 0;
            transition: opacity ${FADE_MS}ms ease;
        }
        dialog.${DIALOG_CLASS}.${VISIBLE_CLASS} { opacity: 1; }
        dialog.${DIALOG_CLASS}::backdrop { background: rgba(0, 0, 0, 0.5); opacity: 0; transition: opacity ${FADE_MS}ms ease; }
        dialog.${DIALOG_CLASS}.${VISIBLE_CLASS}::backdrop { opacity: 1; }
        .${CONTROLS_CLASS} select[hidden] {
            /* [hidden]'s UA default is display:none, which drops the dataset <select> from the
               controls bar's flex row entirely - shrinking the row's height whenever "Show
               values" is unchecked, since align-items: center sizes to the tallest *visible*
               child. Restoring a <select>'s normal display keeps its box in the flex row (so
               the row's height stays put), while visibility: hidden keeps it invisible,
               unclickable, and out of the tab order; the hidden attribute itself remains the
               authoritative a11y signal regardless of this display override. Zeroing width
               (and min-width - a flex item's automatic minimum is min-content, not 0) then
               collapses the space the select's content would otherwise reserve, so only the
               height contribution survives. Scoped to the bar's own class rather than
               dialog.${DIALOG_CLASS} so it also covers the expandable:false inline path,
               which renders the same bar with no <dialog> ancestor. */
            display:   inline-block;
            visibility: hidden;
            width:      0;
            min-width:  0;
            padding:    0;
            border:     0;
        }
        .${RAIL_CLASS} button {
            width: 32px;
            height: 32px;
            padding: 0;
            border: 0;
            border-radius: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: transparent;
            color: inherit;
            cursor: pointer;
        }
        /* Mol*'s viewport controls tell on/off apart by color contrast alone (no size
           or shape change) - opacity is this rail's cross-theme stand-in for that, since
           it dims toward whatever's behind it regardless of the resolved theme color. */
        .${RAIL_CLASS} button > span { opacity: 0.5; }
        .${RAIL_CLASS} button[aria-pressed="true"] > span { opacity: 1; }
        /* Hover always wins over the on/off dimming, same as Mol*'s own toggle-on and
           toggle-off hover rules both resolving to one highlight color. */
        .${RAIL_CLASS} button:hover {
            color: #51a2fb;
            background: rgba(128, 128, 128, 0.15);
            outline: 1px solid currentColor;
            outline-offset: -1px;
        }
        .${RAIL_CLASS} button:hover > span { opacity: 1; }
    `;
    document.head.appendChild(style);
}

/**
 * A small, click-to-enlarge 2D structure viewer. Draws `smiles` at a compact size (no
 * explicit hydrogens) into `container`; clicking (or Enter/Space on) the container opens
 * the same structure at standard size in a modal `<dialog>`. The mini tile carries its
 * own always-visible H/values icon rail, independent of the dialog's checkbox bar.
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
     * @param {Boolean}  [options.showControls=true] Whether to build the mini tile's H/values
     *        icon rail and the expanded dialog's own "Show all H"/"Show values" bar. Set
     *        false when the host has its own H/values UI and wants bare structure views.
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
        this.expandable       = options.expandable ?? true;

        this.smiles   = null;
        this.dialog   = null;
        this.tooltip  = null;
        this.controls = null;

        // State for the mini tile's own H/values toggles (the rail) and the enlarged
        // dialog's (the checkbox bar) - independent of each other, since the tile is
        // compact by design and the dialog is not. Defaults mirror the playground's
        // standard viewer: H labels off, values on, first dataset selected.
        this._miniShowAllH       = false;
        this._miniShowValues     = true;
        this._miniDataset        = this._initialDataset();
        this._expandedShowAllH   = false;
        this._expandedShowValues = true;
        this._expandedDataset    = this._initialDataset();

        this._closing = false;

        this._onClick   = this._onClick.bind(this);
        this._onKeydown  = this._onKeydown.bind(this);
        this._onDialogClick  = this._onDialogClick.bind(this);
        this._onDialogClose  = this._onDialogClose.bind(this);
        this._onDialogCancel = this._onDialogCancel.bind(this);

        if (this.expandable) {
            Object.assign(this.container.style, {cursor: 'pointer'});
            this.container.setAttribute('role', 'button');
            this.container.setAttribute('tabindex', '0');
            this.container.setAttribute('aria-label', 'Enlarge structure');
            this.container.addEventListener('click', this._onClick);
            this.container.addEventListener('keydown', this._onKeydown);
        }
    }

    /**
     * Draws (or redraws) `smiles` into the container - at mini size and click-to-enlarge if
     * `expandable`, or as the expanded-style view directly otherwise.
     * @param {String} smiles
     */
    draw(smiles) {
        this.smiles = smiles;

        if (!this.expandable) {
            this._ensureStage(() => this._buildControls());
            this._drawExpanded();
            return;
        }

        this._ensureStage(() => this._buildRail(), true);
        this._drawMini();
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
            this.dialog = null;
        }
        this.stage     = null;
        this.svgHolder = null;
        this.controls  = null;
        this.rail      = null;
        this._closing  = false;
        this.container.replaceChildren();
    }

    /** Resolves the dataset an unopened toggle should start on: the option given, else the bundle's first key. */
    _initialDataset() {
        return this.dataset ?? Object.keys(this.values?.datasets ?? {})[0] ?? null;
    }

    /** (Re)draws the mini tile with the current H/values toggle state. */
    _drawMini() {
        const options = {...MINI_OPTIONS, ...this.miniOptions};
        if (this._miniShowAllH) {
            options.showCarbons = 'all';
        }

        const drawer = new SmiDrawer(options);
        drawer.draw(this.smiles, 'svg', this.theme, svg => this._finish(svg, drawer), err => this._fail(err));
    }

    _finish(svg, drawer) {
        const background = themeBackground(this.theme, drawer);
        if (background) {
            this.container.style.backgroundColor = background;
        }
        this._styleRail(background);
        this.svgHolder.replaceChildren(svg);
        this._applyValues(svg, drawer, this._miniShowValues ? this._miniDataset : null);
        this.onRender?.(svg, {mode: 'mini', drawer});
    }

    _fail(err) {
        this.svgHolder.replaceChildren();
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
        if (!this.smiles || !this.expandable) {
            return;
        }

        if (!this.dialog) {
            ensureStyle();

            this.dialog = document.createElement('dialog');
            this.dialog.className = DIALOG_CLASS;
            // Border color is set per-draw (inverted from the theme background); the
            // width/style are fixed so only the color needs to change on redraw/retheme.
            // `color: inherit` undoes the UA stylesheet's `dialog { color: CanvasText }` -
            // without it, a `currentColor` theme (e.g. C/H tracking the host's own text
            // color) renders black on `document.body`-appended dialogs regardless of theme.
            Object.assign(this.dialog.style, {
                border: '3px solid transparent', borderRadius: '8px', padding: '16px', color: 'inherit',
            });
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

    /**
     * Builds a stage (svg holder + optional controls) that fills `container` - shared by
     * the mini tile and the `expandable: false` inline path, which both need the same
     * "flex-center within 100%x100%" shape and differ only in which controls they dock
     * (the rail vs. the checkbox bar). Mirrors expand()'s one-time dialog-build block
     * minus the dialog/fade/backdrop parts; unlike the dialog, which sizes to its content,
     * this must fill the host container so the host's own CSS on the SVG (e.g.
     * max-height: 100%) has something real to resolve against.
     * @param {() => HTMLElement} buildControls Builds this mode's controls element.
     * @param {Boolean} [controlsOnContainer=false] Dock the controls to `container` rather
     *        than to the stage. An absolutely positioned element resolves its offsets
     *        against its containing block's *padding* box, so container-docked controls
     *        keep a fixed inset from the host element's visible edge no matter how much
     *        padding the host sets - whereas the stage is a normal block confined to the
     *        content box, which pushes stage-docked controls inwards by that padding.
     *        The mini tile's rail wants the former (it mimics Mol*'s viewport controls,
     *        which sit a fixed 10px off the panel corner); the expanded view's bar keeps
     *        the latter, since it's docked inside a dialog that has no host padding.
     */
    _ensureStage(buildControls, controlsOnContainer = false) {
        if (this.stage) {
            return;
        }
        this.stage = document.createElement('div');
        Object.assign(this.stage.style, {position: 'relative', width: '100%', height: '100%'});
        this.svgHolder = document.createElement('div');
        Object.assign(this.svgHolder.style, {
            width:          '100%', height:         '100%',
            display:        'flex', alignItems:     'center', justifyContent: 'center',
        });
        this.stage.append(this.svgHolder);
        if (this.showControls && !controlsOnContainer) {
            this.stage.append(buildControls());
        }
        // Must precede the container.append() below - replaceChildren() would drop the
        // controls if they were added first.
        this.container.replaceChildren(this.stage);
        if (this.showControls && controlsOnContainer) {
            // Same static -> relative promotion AtomTooltip.attach() does, for the same
            // reason: the host owns this element, and absolute children need it positioned.
            if (window.getComputedStyle(this.container).position === 'static') {
                this.container.style.position = 'relative';
            }
            this.container.append(buildControls());
        }
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
                // A border only makes sense around a floating dialog card, not content
                // sitting inline in a host's own container.
                const paintTarget = this.dialog ?? this.container;
                paintTarget.style.backgroundColor = background;
                if (this.dialog) {
                    paintTarget.style.borderColor = invertHex(background) ?? '#888888';
                }
            }
            this._styleControls(background);
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

    /**
     * Re-colors the controls bar to read against `background` - the same resolved theme
     * background the dialog/container was just painted with. `null` means a transparent
     * surface (the `expandable: false` inline path), where the host owns the surface, so
     * the bar follows it via `currentColor`/`inherit` instead of picking its own colors.
     */
    _styleControls(background) {
        if (this.controls) {
            Object.assign(this.controls.style, chromeStyle(background));
        }
    }

    /** Re-colors the mini tile's rail to read against `background` - see chromeStyle(). */
    _styleRail(background) {
        if (!this.rail) {
            return;
        }
        const {color, colorScheme} = chromeStyle(background);
        Object.assign(this.rail.style, {color, colorScheme});
    }

    /** Builds the "Show all H" / values toggle bar docked to the stage's top-left corner. */
    _buildControls() {
        // Needed here (not just from expand()) so the expandable:false inline path - which
        // never opens a <dialog> - still gets the select[hidden] height-lock rule below.
        // Idempotent: a no-op if expand() already injected it.
        ensureStyle();

        const bar = document.createElement('div');
        bar.className = CONTROLS_CLASS;
        // background/border color/text color are set per-draw by _styleControls(), same
        // "width/style fixed, color set per-draw" pattern as the dialog's border.
        Object.assign(bar.style, {
            position:     'absolute',
            top:          '8px',
            left:         '8px',
            display:      'inline-flex',
            alignItems:   'center',
            gap:          '12px',
            border:       '1px solid transparent',
            borderRadius: '999px',
            padding:      '4px 10px',
            font:         '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
            userSelect:   'none',
            whiteSpace:   'nowrap',
        });
        this.controls = bar;

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

    /**
     * Builds the mini tile's H/values toggle rail - small icon buttons pinned to the
     * stage's left edge, always visible, sized and styled after Mol*'s own viewport
     * controls (32px square, transparent until hovered) since this rail sits next to a
     * Mol* viewer in the primary host app. Mini-tile-only: the expanded view keeps its
     * own checkbox bar (_buildControls()) untouched.
     */
    _buildRail() {
        ensureStyle();

        const rail = document.createElement('div');
        rail.className = RAIL_CLASS;
        // 10px/4px are Mol*'s own $control-spacing and inter-button-group margin, so the
        // rail lines up with a Mol* viewer's controls when the two sit side by side.
        Object.assign(rail.style, {
            position:      'absolute',
            left:          '10px',
            top:           '10px',
            display:       'flex',
            flexDirection: 'column',
            gap:           '4px',
            zIndex:        '1',
        });
        // The rail sits inside the same element the dialog's click-to-open listener is
        // on (see the constructor) - stop both interaction paths here so pressing a rail
        // button can't also trigger expand().
        rail.addEventListener('click', event => event.stopPropagation());
        rail.addEventListener('keydown', event => event.stopPropagation());
        this.rail = rail;

        const hButton = MiniViewer._buildRailButton('H', this._miniShowAllH, (button) => {
            this._miniShowAllH = !this._miniShowAllH;
            button.setAttribute('aria-pressed', String(this._miniShowAllH));
            button.title = hydrogenTitle(this._miniShowAllH);
            this._drawMini();
        });
        hButton.title = hydrogenTitle(this._miniShowAllH);
        rail.append(hButton);

        const datasetKeys = this.values?.datasets ? Object.keys(this.values.datasets) : [];
        if (datasetKeys.length > 0) {
            const vButton = MiniViewer._buildRailButton('#', this._miniShowValues, (button) => {
                this._cycleMiniDataset(datasetKeys);
                button.setAttribute('aria-pressed', String(this._miniShowValues));
                button.title = this._valuesTitle();
                this._drawMini();
            });
            vButton.title = this._valuesTitle();
            rail.append(vButton);
        }

        return rail;
    }

    static _buildRailButton(glyph, pressed, onToggle) {
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('aria-pressed', String(pressed));
        button.append(buildRailIcon(glyph));
        button.addEventListener('click', () => onToggle(button));
        return button;
    }

    /** Advances the mini tile's values button through dataset1 -> dataset2 -> ... -> off -> dataset1. */
    _cycleMiniDataset(keys) {
        if (this._miniShowValues) {
            const nextIndex = keys.indexOf(this._miniDataset) + 1;
            if (nextIndex < keys.length) {
                this._miniDataset = keys[nextIndex];
                return;
            }
            this._miniShowValues = false;
            return;
        }
        this._miniShowValues = true;
        this._miniDataset    = keys[0];
    }

    _valuesTitle() {
        if (!this._miniShowValues) {
            return 'Values: off';
        }
        const dataset = this.values.datasets[this._miniDataset];
        return `Values: ${dataset?.label || this._miniDataset}`;
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
