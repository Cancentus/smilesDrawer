// @ts-check

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Clearance between the atom's drawn glyphs and the near edge of the label, in user units. */
const LABEL_GAP = 3;
/**
 * How far an atom's own text reaches from its vertex, as a multiple of the atom font
 * size. Mirrors SvgWrapper's label mask (fontSizeLarge * 0.75, SvgWrapper.js:974),
 * which is calibrated against the raw pt number - so no pt -> unit conversion here.
 * The wide tier covers the two cases where smiles-drawer runs extra glyphs outwards:
 * stacked implicit hydrogens and attached pseudo-elements ("NH2", "O-O2S").
 */
const GLYPH_RADIUS = 0.75;
const GLYPH_RADIUS_WIDE = 1.9;

/** Value labels are set at this fraction of the atom label size. */
const VALUE_FONT_RATIO = 0.7;
/** Rough advance width of one glyph, as a fraction of the font size. */
const CHAR_WIDTH_RATIO = 0.62;
/** DrawerBase defaultOptions.fontSizeLarge, for callers that don't pass one. */
const DEFAULT_ATOM_FONT_SIZE = 11;

const PKA_PROVIDER_DISPLAY_NAMES = {
    moitessier: 'Moitessier',
    qupkake:    'QupKake',
    unipka:     'Uni-pKa',
};

const PKA_ROLE_COLORS = {
    base: '#059669',
    acid: '#d97706',
};

const SEPARATOR_CLASS = 'atom-value-sep';

/**
 * @typedef {{ text: string, color?: string, title?: string }} AtomValuePart
 * @typedef {{ atom_index: number, parts: AtomValuePart[] }} AtomValueEntry
 * @typedef {{ label: string, entries: AtomValueEntry[], error?: string }} AtomValueDataset
 * @typedef {{ atomOrder: number[]|null, datasets: Record<string, AtomValueDataset> }} AtomValueBundle
 * @typedef {{ vertices: object[], allVertices: object[], atomOrder: number[]|null }} AtomValueTarget
 */

/**
 * Resolve an atom index to the vertex it refers to.
 *
 * @param {number} atomIndex
 * @param {AtomValueTarget} target
 * @returns {object|null}
 */
function vertexForAtomIndex(atomIndex, target) {
    const position = target.atomOrder ? target.atomOrder.indexOf(atomIndex) : atomIndex;
    if (position < 0) {
        return null;
    }
    return target.vertices[position] ?? null;
}

/**
 * @param {AtomValueEntry[]} entries
 * @param {AtomValueTarget} target
 * @returns {Map<object, AtomValueEntry[]>}
 */
function groupEntriesByVertex(entries, target) {
    const groups = new Map();

    for (const entry of entries) {
        const vertex = vertexForAtomIndex(entry.atom_index, target);
        if (!vertex) {
            continue;
        }
        const group = groups.get(vertex);
        if (group) {
            group.push(entry);
        }
        else {
            groups.set(vertex, [entry]);
        }
    }

    for (const [vertex, group] of groups) {
        const merged = {atom_index: group[0].atom_index, parts: []};
        for (const entry of group) {
            merged.parts.push(...entry.parts);
        }
        groups.set(vertex, [merged]);
    }

    return groups;
}

/**
 * Direction pointing away from the mean of the atom's drawn bonds. SVG y grows
 * downward and Vertex.getAngle works in raw SVG coordinates, so this angle is
 * used as-is - no sign flip.
 *
 * @param {object} vertex
 * @param {AtomValueTarget} target
 * @returns {number} Angle in radians.
 */
function outwardAngle(vertex, target) {
    const neighbours = vertex.getDrawnNeighbours(target.allVertices);
    if (neighbours.length === 0) {
        return 0; // Isolated atom: to the right, matching Vertex.getTextDirection.
    }

    let sin = 0;
    let cos = 0;
    for (const id of neighbours) {
        const angle = vertex.getAngle(target.allVertices[id].position);
        sin += Math.sin(angle);
        cos += Math.cos(angle);
    }

    // Bonds cancel out (linear sp atom, symmetric trigonal centre): there is no
    // outward direction, so sit beside the first bond rather than on top of it.
    if (Math.hypot(sin, cos) < 1e-6) {
        return vertex.getAngle(target.allVertices[neighbours[0]].position) + Math.PI / 2;
    }

    return Math.atan2(sin, cos);
}

/**
 * @param {object} vertex
 * @param {AtomValueEntry} entry
 * @param {AtomValueTarget} target
 * @param {number} atomFontSize Atom label size in pt (the drawer's opts.fontSizeLarge).
 * @returns {{ x: number, y: number, fontSize: number, width: number, entry: AtomValueEntry, text: string }}
 */
function placeLabel(vertex, entry, target, atomFontSize) {
    const text = entry.parts.map(part => part.text).join('/');
    // The drawer applies fontSizeLarge as pt in CSS; SVG geometry is in user units.
    const fontSize = atomFontSize * (4 / 3) * VALUE_FONT_RATIO;
    const width = text.length * fontSize * CHAR_WIDTH_RATIO;

    const wide = vertex.value.hasAttachedPseudoElements || vertex.value.countImplicitHydrogens() > 0;
    const clearance = atomFontSize * (wide ? GLYPH_RADIUS_WIDE : GLYPH_RADIUS) + LABEL_GAP;

    // Push the label's centre out past `clearance`, plus a direction-dependent
    // allowance for the label's own half-width/half-height - modelled as an ellipse
    // rather than the box's true corner distance, which smoothly interpolates
    // between the two (halfWidth at 0°, halfHeight at 90°) and, unlike the box
    // corner, never exceeds the larger of the two. A box's actual corner distance
    // peaks *between* the cardinals (near the box's own diagonal angle), which is
    // what made diagonally-placed labels sit farther out than horizontal or
    // vertical ones instead of somewhere in between.
    const angle = outwardAngle(vertex, target);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const halfWidth = width / 2;
    const halfHeight = fontSize / 2;
    const labelRadius = 1 / Math.hypot(cos / halfWidth, sin / halfHeight);
    const distance = clearance + labelRadius;

    return {
        x: vertex.position.x + cos * distance,
        y: vertex.position.y + sin * distance,
        fontSize,
        width,
        entry,
        text,
    };
}

/**
 * @param {AtomValueDataset} dataset
 * @param {AtomValueTarget} target
 * @param {number} atomFontSize
 * @returns {Array<{ x: number, y: number, fontSize: number, width: number, entry: AtomValueEntry, text: string }>}
 */
function placeDatasetLabels(dataset, target, atomFontSize) {
    const groups = groupEntriesByVertex(dataset.entries, target);
    const labels = [];

    for (const [, group] of groups) {
        const entry = group[0];
        const vertex = vertexForAtomIndex(entry.atom_index, target);
        if (!vertex) {
            continue;
        }
        labels.push(placeLabel(vertex, entry, target, atomFontSize));
    }

    return labels;
}

/**
 * @param {SVGSVGElement} svgEl
 * @param {Array<{ x: number, y: number, width: number, fontSize: number }>} labels
 */
function fitViewBoxToLabels(svgEl, labels) {
    const viewBox = svgEl.getAttribute('viewBox');
    if (!viewBox || labels.length === 0) {
        return;
    }

    const parts = viewBox.split(/[\s,]+/).map(Number);
    if (parts.length !== 4 || parts.some(n => !Number.isFinite(n))) {
        return;
    }

    const [vx, vy, vw, vh] = parts;
    let minX = vx;
    let minY = vy;
    let maxX = vx + vw;
    let maxY = vy + vh;

    for (const label of labels) {
        const halfWidth = label.width / 2;
        const halfHeight = label.fontSize / 2;
        minX = Math.min(minX, label.x - halfWidth);
        minY = Math.min(minY, label.y - halfHeight);
        maxX = Math.max(maxX, label.x + halfWidth);
        maxY = Math.max(maxY, label.y + halfHeight);
    }

    if (minX === vx && minY === vy && maxX === vx + vw && maxY === vy + vh) {
        return;
    }

    svgEl.setAttribute('viewBox', `${minX} ${minY} ${maxX - minX} ${maxY - minY}`);
}

/**
 * @param {AtomValuePart} part
 * @param {string} [defaultColor]
 * @returns {string}
 */
function partFill(part, defaultColor) {
    return part.color || defaultColor || 'currentColor';
}

/**
 * @param {object} json
 * @returns {boolean}
 */
function isGenericBundleShape(json) {
    return Boolean(json && typeof json === 'object' && json.datasets && typeof json.datasets === 'object');
}

/**
 * @param {object} json
 * @returns {boolean}
 */
function isPkaShape(json) {
    if (!json || typeof json !== 'object') {
        return false;
    }
    if (json.pka_methods && typeof json.pka_methods === 'object') {
        return true;
    }
    if (json.properties?.pka_methods && typeof json.properties.pka_methods === 'object') {
        return true;
    }
    if (Array.isArray(json.sites)) {
        return true;
    }
    if (json.pka && Array.isArray(json.pka.sites)) {
        return true;
    }
    return false;
}

/**
 * @param {string} provider
 * @returns {string}
 */
export function providerDisplayName(provider) {
    return PKA_PROVIDER_DISPLAY_NAMES[provider] ?? provider;
}

/**
 * @param {'acid'|'base'} role
 * @returns {string}
 */
export function pkaRoleColor(role) {
    return PKA_ROLE_COLORS[role] ?? PKA_ROLE_COLORS.acid;
}

/**
 * @param {object} site
 * @returns {AtomValuePart}
 */
function pkaSiteToPart(site) {
    return {
        text:  Number(site.pka).toFixed(1),
        color: pkaRoleColor(site.role),
        title: site.role,
    };
}

/**
 * @param {object} payload
 * @param {string} key
 * @returns {AtomValueDataset|null}
 */
function pkaPayloadToDataset(payload, key) {
    if (!payload || typeof payload !== 'object') {
        return null;
    }

    const label = providerDisplayName(payload.provider || key);
    if (typeof payload.error === 'string' && payload.error) {
        return {label, entries: [], error: payload.error};
    }

    if (!Array.isArray(payload.sites) || payload.sites.length === 0) {
        return {label, entries: []};
    }

    /** @type {Map<number, AtomValuePart[]>} */
    const byAtom = new Map();

    for (const site of payload.sites) {
        if (typeof site.atom_index !== 'number' || !Number.isFinite(site.pka)) {
            continue;
        }
        const parts = byAtom.get(site.atom_index) ?? [];
        parts.push(pkaSiteToPart(site));
        byAtom.set(site.atom_index, parts);
    }

    /** @type {AtomValueEntry[]} */
    const entries = [];

    for (const [atomIndex, parts] of byAtom) {
        const ordered = [...parts].sort(
            (a, b) => Number(a.title === 'acid') - Number(b.title === 'acid')
                || Number(a.text) - Number(b.text),
        );
        const seen = new Set();
        const deduped = ordered.filter((part) => {
            const dedupeKey = `${part.title}:${part.text}`;
            if (seen.has(dedupeKey)) {
                return false;
            }
            seen.add(dedupeKey);
            return true;
        });
        entries.push({atom_index: atomIndex, parts: deduped});
    }

    return {label, entries};
}

/**
 * Normalize AIDD pKa JSON into an AtomValueBundle.
 *
 * @param {object} json
 * @returns {AtomValueBundle}
 */
export function parsePkaDatasets(json) {
    if (!json || typeof json !== 'object') {
        throw new Error('pKa JSON must be an object.');
    }

    const root = json.properties && typeof json.properties === 'object' ? json.properties : json;
    let methods = root.pka_methods;

    if (!methods || typeof methods !== 'object') {
        if (Array.isArray(json.sites)) {
            methods = {default: json};
        }
        else if (json.pka && Array.isArray(json.pka.sites)) {
            methods = {moitessier: json.pka};
        }
        else {
            throw new Error('No pka_methods or sites array found in JSON.');
        }
    }

    const atomOrder = root.smiles_explicit_h_atom_order
        ?? json.smiles_explicit_h_atom_order
        ?? json.atom_order
        ?? null;

    /** @type {Record<string, AtomValueDataset>} */
    const datasets = {};

    for (const [key, payload] of Object.entries(methods)) {
        const dataset = pkaPayloadToDataset(payload, key);
        if (dataset) {
            datasets[key] = dataset;
        }
    }

    return {atomOrder, datasets};
}

/**
 * Normalize generic or pKa JSON into an AtomValueBundle.
 *
 * @param {object} json
 * @returns {AtomValueBundle}
 */
export function parseAtomValueBundle(json) {
    if (!json || typeof json !== 'object') {
        throw new Error('Values JSON must be an object.');
    }

    if (isGenericBundleShape(json)) {
        const atomOrder = json.atom_order ?? json.atomOrder ?? null;
        /** @type {Record<string, AtomValueDataset>} */
        const datasets = {};

        for (const [key, raw] of Object.entries(json.datasets)) {
            if (!raw || typeof raw !== 'object') {
                continue;
            }
            const label = typeof raw.label === 'string' ? raw.label : key;
            const entries = Array.isArray(raw.entries) ? raw.entries : [];
            const error = typeof raw.error === 'string' ? raw.error : undefined;
            datasets[key] = {label, entries, error};
        }

        return {atomOrder, datasets};
    }

    if (isPkaShape(json)) {
        return parsePkaDatasets(json);
    }

    throw new Error('Unrecognized values JSON shape. Expected { datasets: ... } or pKa backend format.');
}

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
export function apply(svgEl, dataset, target, options = {}) {
    if (!dataset?.entries?.length) {
        return svgEl;
    }

    const atomFontSize = options.atomFontSize ?? DEFAULT_ATOM_FONT_SIZE;

    const overlay = document.createElementNS(SVG_NS, 'g');
    overlay.setAttribute('class', 'atom-value-overlay');
    overlay.setAttribute('pointer-events', 'none');

    const placed = placeDatasetLabels(dataset, target, atomFontSize);

    for (const label of placed) {
        const entry = label.entry;

        const text = document.createElementNS(SVG_NS, 'text');
        text.setAttribute('x', String(label.x));
        text.setAttribute('y', String(label.y));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'central');
        text.setAttribute('font-size', String(label.fontSize));
        text.setAttribute('font-weight', '600');
        text.setAttribute('font-family', 'ui-sans-serif, system-ui, sans-serif');

        entry.parts.forEach((part, index) => {
            if (index > 0) {
                const sep = document.createElementNS(SVG_NS, 'tspan');
                sep.setAttribute('class', SEPARATOR_CLASS);
                if (options.separatorColor) {
                    sep.setAttribute('fill', options.separatorColor);
                }
                sep.textContent = '/';
                text.appendChild(sep);
            }

            const value = document.createElementNS(SVG_NS, 'tspan');
            value.setAttribute('fill', partFill(part, options.defaultColor));
            value.textContent = part.text;
            text.appendChild(value);
        });

        overlay.appendChild(text);
    }

    svgEl.appendChild(overlay);
    fitViewBoxToLabels(svgEl, placed);
    return svgEl;
}

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
export function fitViewBoxToBundle(svgEl, bundle, target, options = {}) {
    if (!bundle?.datasets) {
        return svgEl;
    }

    const atomFontSize = options.atomFontSize ?? DEFAULT_ATOM_FONT_SIZE;
    const labels = [];

    for (const dataset of Object.values(bundle.datasets)) {
        if (!dataset?.entries?.length) {
            continue;
        }
        labels.push(...placeDatasetLabels(dataset, target, atomFontSize));
    }

    fitViewBoxToLabels(svgEl, labels);
    return svgEl;
}

/**
 * Build AtomTooltip extra rows for all datasets on one atom.
 *
 * @param {number} atomIdx
 * @param {AtomValueBundle|null|undefined} bundle
 * @returns {Array<[string, string, string?]|{ label: string, parts: AtomValuePart[] }|{ label: string, value: string, muted?: boolean }>}
 */
export function buildTooltipRows(atomIdx, bundle) {
    if (!bundle?.datasets) {
        return [];
    }

    /** @type {Array<[string, string, string?]|{ label: string, parts: AtomValuePart[] }|{ label: string, value: string, muted?: boolean }>} */
    const rows = [];

    for (const dataset of Object.values(bundle.datasets)) {
        const entry = dataset.entries.find(candidate => candidate.atom_index === atomIdx);

        if (entry?.parts?.length) {
            rows.push({label: dataset.label, parts: entry.parts});
            continue;
        }

        if (dataset.error) {
            rows.push({label: dataset.label, value: dataset.error, muted: true});
        }
    }

    return rows;
}

/**
 * CSS rules for host styling of overlay labels.
 *
 * @returns {string}
 */
export function overlayCss() {
    return [
        '.atom-value-overlay .atom-value-sep { fill: #71717a; }',
        '.dark .atom-value-overlay .atom-value-sep { fill: #a1a1aa; }',
    ].join('\n');
}

export default {
    apply,
    buildTooltipRows,
    fitViewBoxToBundle,
    overlayCss,
    parseAtomValueBundle,
    parsePkaDatasets,
    providerDisplayName,
    pkaRoleColor,
};
