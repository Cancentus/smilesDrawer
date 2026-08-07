// @ts-check
import {buildTooltipRows} from './AtomValueOverlay.js';

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
    constructor(svg, options = {}) {
        this.svg = svg;
        this.container = options.container || svg.parentElement;
        this.corner = options.corner || 'bottom-right';
        this.getExtra = options.getExtra || null;
        this.atomValueBundle = options.atomValueBundle ?? null;
        this.box = null;
        this.hoveredId = null;

        if (!this.container) {
            throw new Error('AtomTooltip: svg has no parentElement; pass options.container explicitly.');
        }

        this._onPointerMove  = this._onPointerMove.bind(this);
        this._onPointerLeave = this._onPointerLeave.bind(this);
    }

    /**
     * Creates the tooltip box and starts listening for hover on the SVG. No-op if already attached.
     */
    attach() {
        if (this.box) {
            return;
        }

        if (window.getComputedStyle(this.container).position === 'static') {
            this.container.style.position = 'relative';
        }

        this.box = document.createElement('div');
        this.box.className = 'sd-atom-tooltip';
        Object.assign(this.box.style, {
            position:                                             'absolute',
            [this.corner.includes('bottom') ? 'bottom' : 'top']:  '8px',
            [this.corner.includes('right')  ? 'right'  : 'left']: '8px',
            padding:                                              '6px 10px',
            background:                                           'rgba(20, 20, 20, 0.75)',
            color:                                                '#fff',
            font:                                                 '12px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
            borderRadius:                                         '6px',
            pointerEvents:                                        'none',
            display:                                              'none',
            zIndex:                                               '10',
        });
        this.container.appendChild(this.box);

        this.svg.addEventListener('pointermove', this._onPointerMove);
        this.svg.addEventListener('pointerleave', this._onPointerLeave);
    }

    /**
     * Removes the tooltip box and stops listening. Safe to call more than once.
     */
    destroy() {
        this.svg.removeEventListener('pointermove', this._onPointerMove);
        this.svg.removeEventListener('pointerleave', this._onPointerLeave);
        if (this.box) {
            this.box.remove();
            this.box = null;
        }
        this.hoveredId = null;
    }

    _onPointerMove(event) {
        const target = event.target.closest('[data-vertex-id]');
        if (!target) {
            this._hide();
            return;
        }

        const id = target.getAttribute('data-vertex-id');
        if (id === this.hoveredId) {
            return;
        }
        this.hoveredId = id;
        this._show(target.dataset);
    }

    _onPointerLeave() {
        this._hide();
    }

    _show(dataset) {
        const header = document.createElement('div');
        header.textContent = AtomTooltip.formatLabel(dataset);
        Object.assign(header.style, {
            fontSize:   '1.5em',
            fontWeight: 'bold',
            lineHeight: '1.2',
            marginBottom: '4px',
        });
        if (dataset.color) {
            // ponytail: tooltip box is always dark, so carbon's theme color (often near-black) stays white here
            header.style.color = dataset.element === 'C' ? '#fff' : dataset.color;
        }

        const body = document.createElement('div');
        body.style.whiteSpace = 'pre';
        body.textContent = AtomTooltip.formatInfo(dataset);

        const children = [header, body];

        const extraRows = [];

        if (this.getExtra) {
            extraRows.push(...this.getExtra(dataset));
        }

        if (this.atomValueBundle && dataset.atomIdx !== undefined) {
            extraRows.push(...buildTooltipRows(Number(dataset.atomIdx), this.atomValueBundle));
        }

        for (const row of extraRows) {
            children.push(AtomTooltip._renderExtraRow(row));
        }

        this.box.replaceChildren(...children);
        this.box.style.display = 'block';
    }

    _hide() {
        this.hoveredId = null;
        this.box.style.display = 'none';
    }

    /**
     * @param {[string, string, string?]|{ label: string, parts?: object[], value?: string, muted?: boolean }} row
     * @returns {HTMLDivElement}
     */
    static _renderExtraRow(row) {
        if (Array.isArray(row)) {
            const [label, value, color] = row;
            const rowEl = document.createElement('div');
            if (!label && !value) {
                return rowEl;
            }
            rowEl.textContent = `${label}: ${value}`;
            if (color) {
                rowEl.style.color = color;
            }
            return rowEl;
        }

        const rowEl = document.createElement('div');
        rowEl.style.marginTop = '2px';

        if (row.parts && row.parts.length > 0) {
            const labelSpan = document.createElement('span');
            labelSpan.textContent = `${row.label}: `;
            labelSpan.style.opacity = '0.85';
            rowEl.appendChild(labelSpan);

            row.parts.forEach((part, index) => {
                if (index > 0) {
                    const sep = document.createElement('span');
                    sep.textContent = ' / ';
                    sep.style.opacity = '0.6';
                    rowEl.appendChild(sep);
                }
                if (part.title) {
                    const title = document.createElement('span');
                    title.textContent = `${part.title} `;
                    title.style.opacity = '0.75';
                    rowEl.appendChild(title);
                }
                const value = document.createElement('span');
                value.textContent = part.text;
                if (part.color) {
                    value.style.color = part.color;
                }
                rowEl.appendChild(value);
            });
            return rowEl;
        }

        rowEl.textContent = `${row.label}: ${row.value ?? ''}`;
        if (row.muted) {
            rowEl.style.opacity = '0.65';
            rowEl.style.fontStyle = 'italic';
        }
        return rowEl;
    }

    /**
     * Formats the element+number label shown as the tooltip header (1-based numbering).
     *
     * @param {DOMStringMap} dataset
     * @returns {string}
     */
    static formatLabel(dataset) {
        const number = dataset.atomIdx !== undefined
            ? Number(dataset.atomIdx) + 1
            : Number(dataset.vertexId) + 1;

        return `${dataset.element}${number}`;
    }

    /**
     * Formats a hit-target's dataset into the tooltip's text content, one field per line,
     * omitting empty/default fields so the box stays compact.
     *
     * @param {DOMStringMap} dataset
     * @returns {string}
     */
    static formatInfo(dataset) {
        const lines = [];

        lines.push(dataset.atomIdx !== undefined
            ? `Atom #${dataset.atomIdx}`
            : `Atom (H) #${dataset.vertexId}`);
        lines.push(`Element: ${dataset.element}`);

        const charge = Number(dataset.charge);
        if (charge) {
            lines.push(`Charge: ${charge > 0 ? '+' : ''}${charge}`);
        }

        const isotope = Number(dataset.isotope);
        if (isotope) {
            lines.push(`Isotope: ${isotope}`);
        }

        const hydrogens = Number(dataset.hydrogens);
        if (hydrogens) {
            lines.push(`Hydrogens: ${hydrogens}`);
        }

        if (dataset.rings) {
            lines.push(`Ring: ${dataset.rings}`);
        }

        if (dataset.aromatic) {
            lines.push('Aromatic: yes');
        }

        if (dataset.class !== undefined) {
            lines.push(`Class: ${dataset.class}`);
        }

        return lines.join('\n');
    }
}
