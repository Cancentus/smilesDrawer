import {describe, it, expect, vi} from 'vitest';
import {createJSDOM}              from '../helpers';

import MiniViewer from '../../src/MiniViewer.js';

describe('MiniViewer', () => {
    it('draws compactly by default: fewer glyphs than an explicit-hydrogens render', () => {
        const dom = createJSDOM();
        const container = dom.window.document.createElement('div');
        dom.window.document.body.appendChild(container);

        // Scoped to the drawn structure rather than the whole container, so the count can't
        // drift with whatever chrome the rail happens to render.
        const structureGlyphs = () => container.querySelectorAll('svg text').length;

        const viewer = new MiniViewer(container);
        viewer.draw('[H]C([H])([H])O');
        const miniGlyphs = structureGlyphs();

        // Same SMILES, but with explicit hydrogens turned back on - the mini preset's
        // point is precisely that it draws fewer glyphs than this by default.
        const explicit = new MiniViewer(container, {miniOptions: {explicitHydrogens: true}});
        explicit.draw('[H]C([H])([H])O');
        const explicitGlyphs = structureGlyphs();

        expect(miniGlyphs).toBeGreaterThan(0);
        expect(miniGlyphs).toBeLessThan(explicitGlyphs);
    });

    it('sets up the container as an activatable control', () => {
        const dom = createJSDOM();
        const container = dom.window.document.createElement('div');
        dom.window.document.body.appendChild(container);

        new MiniViewer(container);

        expect(container.getAttribute('role')).toBe('button');
        expect(container.getAttribute('tabindex')).toBe('0');
        expect(container.style.cursor).toBe('pointer');
    });

    it('click opens a modal dialog with the enlarged structure', () => {
        const dom = createJSDOM();
        const container = dom.window.document.createElement('div');
        dom.window.document.body.appendChild(container);

        const viewer = new MiniViewer(container);
        viewer.draw('CCO');

        container.dispatchEvent(new dom.window.MouseEvent('click', {bubbles: true}));

        const dialog = dom.window.document.body.querySelector('dialog');
        expect(dialog).not.toBeNull();
        expect(dialog.querySelector('svg')).not.toBeNull();
    });

    it('colors the container and the dialog to match the theme background', () => {
        const dom = createJSDOM();
        const container = dom.window.document.createElement('div');
        dom.window.document.body.appendChild(container);

        const viewer = new MiniViewer(container, {theme: 'dark'});
        viewer.draw('CCO');
        expect(container.style.backgroundColor).toBe('rgb(20, 20, 20)');

        container.dispatchEvent(new dom.window.MouseEvent('click', {bubbles: true}));
        const dialog = dom.window.document.body.querySelector('dialog');
        expect(dialog.style.backgroundColor).toBe('rgb(20, 20, 20)');
    });

    it('the enlarged dialog has a "Show all H" toggle that redraws with all carbons labeled', () => {
        const dom = createJSDOM();
        const container = dom.window.document.createElement('div');
        dom.window.document.body.appendChild(container);

        const viewer = new MiniViewer(container);
        viewer.draw('CCCCC');
        container.dispatchEvent(new dom.window.MouseEvent('click', {bubbles: true}));

        const dialog = dom.window.document.body.querySelector('dialog');
        const checkbox = [...dialog.querySelectorAll('input[type="checkbox"]')]
            .find(el => el.parentElement.textContent.includes('Show all H'));
        expect(checkbox).toBeTruthy();
        expect(checkbox.checked).toBe(false);

        const glyphsBefore = dialog.querySelectorAll('text').length;
        checkbox.checked = true;
        checkbox.dispatchEvent(new dom.window.Event('change', {bubbles: true}));
        const glyphsAfter = dialog.querySelectorAll('text').length;

        expect(glyphsAfter).toBeGreaterThan(glyphsBefore);
    });

    it('the enlarged dialog has a values toggle and dataset picker when a values bundle is given', () => {
        const dom = createJSDOM();
        const container = dom.window.document.createElement('div');
        dom.window.document.body.appendChild(container);

        const values = {
            atomOrder: null,
            datasets: {
                m1: {label: 'Method 1', entries: [{atom_index: 0, parts: [{text: '4.2'}]}]},
            },
        };

        const viewer = new MiniViewer(container, {values, dataset: 'm1'});
        viewer.draw('CCO');
        container.dispatchEvent(new dom.window.MouseEvent('click', {bubbles: true}));

        const dialog = dom.window.document.body.querySelector('dialog');
        expect(dialog.querySelectorAll('.atom-value-overlay text').length).toBeGreaterThan(0);

        const select = dialog.querySelector('select');
        expect(select).toBeTruthy();
        expect(select.hidden).toBe(false);

        const valuesCheckbox = [...dialog.querySelectorAll('input[type="checkbox"]')]
            .find(el => el.parentElement.textContent.includes('Show values'));
        expect(valuesCheckbox.checked).toBe(true);

        valuesCheckbox.checked = false;
        valuesCheckbox.dispatchEvent(new dom.window.Event('change', {bubbles: true}));

        expect(select.hidden).toBe(true);
        expect(dialog.querySelectorAll('.atom-value-overlay text').length).toBe(0);
    });

    it('showControls: false omits the built-in H/values toggle bar', () => {
        const dom = createJSDOM();
        const container = dom.window.document.createElement('div');
        dom.window.document.body.appendChild(container);

        const values = {atomOrder: null, datasets: {m1: {label: 'M1', entries: [{atom_index: 0, parts: [{text: '1.0'}]}]}}};
        const viewer = new MiniViewer(container, {showControls: false, values, dataset: 'm1'});
        viewer.draw('CCO');
        container.dispatchEvent(new dom.window.MouseEvent('click', {bubbles: true}));

        const dialog = dom.window.document.body.querySelector('dialog');
        expect(dialog.querySelectorAll('input[type="checkbox"]').length).toBe(0);
        expect(dialog.querySelector('select')).toBeNull();
        // The generic overlay still applies for a host that skips only the built-in UI.
        expect(dialog.querySelectorAll('.atom-value-overlay text').length).toBeGreaterThan(0);
    });

    it('the mini tile has an H/values icon rail, separate from the dialog\'s checkbox bar', () => {
        const dom = createJSDOM();
        const container = dom.window.document.createElement('div');
        dom.window.document.body.appendChild(container);

        const values = {atomOrder: null, datasets: {m1: {label: 'Method 1', entries: [{atom_index: 0, parts: [{text: '1.0'}]}]}}};
        const viewer = new MiniViewer(container, {values, dataset: 'm1'});
        viewer.draw('CCO');

        const rail = container.querySelector('.sd-mini-viewer-rail');
        expect(rail).not.toBeNull();
        expect(rail.querySelectorAll('button').length).toBe(2);
    });

    it('docks the rail to the container itself, so host padding can\'t push it inwards', () => {
        // The regression this guards: the rail used to live inside the stage, a normal block
        // confined to the container's content box, so a padded host (aidd_frontend's
        // Ligand2dViewer sets p-4) pushed it 16px further in than Mol*'s equivalent controls.
        // Docked to the container, its offsets resolve against the padding box instead.
        const dom = createJSDOM();
        const container = dom.window.document.createElement('div');
        container.style.padding = '16px';
        dom.window.document.body.appendChild(container);

        const viewer = new MiniViewer(container);
        viewer.draw('CCO');

        const rail = container.querySelector('.sd-mini-viewer-rail');
        expect(rail.parentElement).toBe(container);
        expect(rail.style.left).toBe('10px');
        expect(rail.style.top).toBe('10px');
        // Absolute offsets need a positioned containing block; the container is the host's
        // element, so promote it only when it is still static (as AtomTooltip does).
        expect(container.style.position).toBe('relative');
    });

    it('leaves an already-positioned host container\'s position alone', () => {
        const dom = createJSDOM();
        const container = dom.window.document.createElement('div');
        container.style.position = 'absolute';
        dom.window.document.body.appendChild(container);

        const viewer = new MiniViewer(container);
        viewer.draw('CCO');

        expect(container.style.position).toBe('absolute');
    });

    it('renders the rail glyphs as real text at a px font size, not viewBox-scaled SVG', () => {
        // A 24-unit viewBox rendered into a 17px box scaled the old SVG <text>'s font-size
        // down by 17/24, so the number in the source was not the size that rendered.
        const dom = createJSDOM();
        const container = dom.window.document.createElement('div');
        dom.window.document.body.appendChild(container);

        const values = {atomOrder: null, datasets: {m1: {label: 'M1', entries: [{atom_index: 0, parts: [{text: '1.0'}]}]}}};
        const viewer = new MiniViewer(container, {values, dataset: 'm1'});
        viewer.draw('CCO');

        const glyphs = [...container.querySelectorAll('.sd-mini-viewer-rail button > span')];
        expect(glyphs.map(el => el.textContent)).toEqual(['H', '#']);
        expect(glyphs[0].style.fontSize).toBe('12px');
        expect(container.querySelector('.sd-mini-viewer-rail svg')).toBeNull();
    });

    it('names the active value type as plain text in the bottom-left corner', () => {
        const dom = createJSDOM();
        const container = dom.window.document.createElement('div');
        container.style.padding = '16px';
        dom.window.document.body.appendChild(container);

        const values = {
            atomOrder: null,
            datasets: {
                m1: {label: 'Method 1', entries: [{atom_index: 0, parts: [{text: '4.2'}]}]},
                m2: {label: 'Method 2', entries: [{atom_index: 0, parts: [{text: '5.1'}]}]},
            },
        };
        const viewer = new MiniViewer(container, {values, dataset: 'm1'});
        viewer.draw('CCO');

        const caption = container.querySelector('.sd-mini-viewer-value-type');
        expect(caption.textContent).toBe('Method 1');
        // Docked to the container like the rail, so host padding can't shift it either.
        expect(caption.parentElement).toBe(container);
        expect(caption.style.left).toBe('10px');
        expect(caption.style.bottom).toBe('10px');
        expect(caption.style.top).toBe('');
        // A caption, not a control: it must not eat clicks meant for the enlarge affordance.
        expect(caption.style.pointerEvents).toBe('none');
        expect(caption.querySelector('svg')).toBeNull();
    });

    it('the value-type caption follows the values button through the cycle', () => {
        const dom = createJSDOM();
        const container = dom.window.document.createElement('div');
        dom.window.document.body.appendChild(container);

        const values = {
            atomOrder: null,
            datasets: {
                m1: {label: 'Method 1', entries: [{atom_index: 0, parts: [{text: '4.2'}]}]},
                m2: {label: 'Method 2', entries: [{atom_index: 0, parts: [{text: '5.1'}]}]},
            },
        };
        const viewer = new MiniViewer(container, {values, dataset: 'm1'});
        viewer.draw('CCO');

        const caption = () => container.querySelector('.sd-mini-viewer-value-type').textContent;
        const vButton = container.querySelectorAll('.sd-mini-viewer-rail button')[1];
        const click = () => vButton.dispatchEvent(new dom.window.MouseEvent('click', {bubbles: true}));

        expect(caption()).toBe('Method 1');
        click();
        expect(caption()).toBe('Method 2');
        click();
        expect(caption()).toBe(''); // values off - nothing to name
        click();
        expect(caption()).toBe('Method 1');
    });

    it('falls back to the dataset key when it carries no label', () => {
        const dom = createJSDOM();
        const container = dom.window.document.createElement('div');
        dom.window.document.body.appendChild(container);

        const values = {atomOrder: null, datasets: {unipka: {entries: [{atom_index: 0, parts: [{text: '4.2'}]}]}}};
        const viewer = new MiniViewer(container, {values, dataset: 'unipka'});
        viewer.draw('CCO');

        expect(container.querySelector('.sd-mini-viewer-value-type').textContent).toBe('unipka');
    });

    it('omits the value-type caption entirely when there are no values', () => {
        const dom = createJSDOM();
        const container = dom.window.document.createElement('div');
        dom.window.document.body.appendChild(container);

        const viewer = new MiniViewer(container);
        viewer.draw('CCO');

        expect(container.querySelector('.sd-mini-viewer-value-type')).toBeNull();
        expect(container.querySelector('.sd-mini-viewer-rail')).not.toBeNull();
    });

    it('showControls: false omits the mini tile\'s rail too', () => {
        const dom = createJSDOM();
        const container = dom.window.document.createElement('div');
        dom.window.document.body.appendChild(container);

        const viewer = new MiniViewer(container, {showControls: false});
        viewer.draw('CCO');

        expect(container.querySelector('.sd-mini-viewer-rail')).toBeNull();
    });

    it('expandable: false has no mini rail (it renders the expanded view directly)', () => {
        const dom = createJSDOM();
        const container = dom.window.document.createElement('div');
        dom.window.document.body.appendChild(container);

        const viewer = new MiniViewer(container, {expandable: false});
        viewer.draw('CCO');

        expect(container.querySelector('.sd-mini-viewer-rail')).toBeNull();
    });

    it('the rail\'s H button redraws the mini tile with all carbons labeled, without opening the dialog', () => {
        const dom = createJSDOM();
        const container = dom.window.document.createElement('div');
        dom.window.document.body.appendChild(container);

        const viewer = new MiniViewer(container);
        viewer.draw('CCCCC');

        const hButton = container.querySelector('.sd-mini-viewer-rail button');
        expect(hButton.getAttribute('aria-pressed')).toBe('false');
        expect(hButton.title).toBe('Show all hydrogens');

        // The rail's glyphs are plain HTML text, so the only <svg> here is the structure.
        const structureSvg = () => container.querySelector('svg');
        const glyphsBefore = structureSvg().querySelectorAll('text').length;

        hButton.dispatchEvent(new dom.window.MouseEvent('click', {bubbles: true}));

        expect(hButton.getAttribute('aria-pressed')).toBe('true');
        expect(hButton.title).toBe('Hide all hydrogens');
        expect(structureSvg().querySelectorAll('text').length).toBeGreaterThan(glyphsBefore);

        // Rail clicks are nested inside the same element the dialog opens from - must
        // not also trigger expand().
        expect(dom.window.document.body.querySelector('dialog')).toBeNull();
    });

    it('the rail\'s values button cycles dataset -> dataset -> off -> dataset', () => {
        const dom = createJSDOM();
        const container = dom.window.document.createElement('div');
        dom.window.document.body.appendChild(container);

        const values = {
            atomOrder: null,
            datasets: {
                m1: {label: 'Method 1', entries: [{atom_index: 0, parts: [{text: '4.2'}]}]},
                m2: {label: 'Method 2', entries: [{atom_index: 0, parts: [{text: '5.1'}]}]},
            },
        };
        const viewer = new MiniViewer(container, {values, dataset: 'm1'});
        viewer.draw('CCO');

        const vButton = container.querySelectorAll('.sd-mini-viewer-rail button')[1];
        const valueCount = () => container.querySelectorAll('.atom-value-overlay text').length;

        expect(vButton.getAttribute('aria-pressed')).toBe('true');
        expect(vButton.title).toBe('Values: Method 1');
        expect(valueCount()).toBeGreaterThan(0);

        vButton.dispatchEvent(new dom.window.MouseEvent('click', {bubbles: true}));
        expect(vButton.getAttribute('aria-pressed')).toBe('true');
        expect(vButton.title).toBe('Values: Method 2');
        expect(valueCount()).toBeGreaterThan(0);

        vButton.dispatchEvent(new dom.window.MouseEvent('click', {bubbles: true}));
        expect(vButton.getAttribute('aria-pressed')).toBe('false');
        expect(vButton.title).toBe('Values: off');
        expect(valueCount()).toBe(0);

        vButton.dispatchEvent(new dom.window.MouseEvent('click', {bubbles: true}));
        expect(vButton.getAttribute('aria-pressed')).toBe('true');
        expect(vButton.title).toBe('Values: Method 1');
        expect(valueCount()).toBeGreaterThan(0);
    });

    it('a single-dataset bundle makes the rail\'s values button a plain on/off toggle', () => {
        const dom = createJSDOM();
        const container = dom.window.document.createElement('div');
        dom.window.document.body.appendChild(container);

        const values = {atomOrder: null, datasets: {m1: {label: 'Method 1', entries: [{atom_index: 0, parts: [{text: '4.2'}]}]}}};
        const viewer = new MiniViewer(container, {values, dataset: 'm1'});
        viewer.draw('CCO');

        const vButton = container.querySelectorAll('.sd-mini-viewer-rail button')[1];
        const valueCount = () => container.querySelectorAll('.atom-value-overlay text').length;

        expect(valueCount()).toBeGreaterThan(0);
        vButton.dispatchEvent(new dom.window.MouseEvent('click', {bubbles: true}));
        expect(valueCount()).toBe(0);
        vButton.dispatchEvent(new dom.window.MouseEvent('click', {bubbles: true}));
        expect(valueCount()).toBeGreaterThan(0);
    });

    it('the rail has only the H button when no values bundle is given', () => {
        const dom = createJSDOM();
        const container = dom.window.document.createElement('div');
        dom.window.document.body.appendChild(container);

        const viewer = new MiniViewer(container);
        viewer.draw('CCO');

        expect(container.querySelectorAll('.sd-mini-viewer-rail button').length).toBe(1);
    });

    it('onRender is called for both the mini and expanded draws, for host-specific post-processing', () => {
        const dom = createJSDOM();
        const container = dom.window.document.createElement('div');
        dom.window.document.body.appendChild(container);

        const calls = [];
        const viewer = new MiniViewer(container, {
            onRender: (svg, info) => {
                calls.push(info.mode);
                svg.setAttribute('data-touched-by', info.mode);
            },
        });
        viewer.draw('CCO');
        expect(calls).toEqual(['mini']);
        expect(container.querySelector('svg').getAttribute('data-touched-by')).toBe('mini');

        container.dispatchEvent(new dom.window.MouseEvent('click', {bubbles: true}));
        expect(calls).toEqual(['mini', 'expanded']);
        const dialog = dom.window.document.body.querySelector('dialog');
        expect(dialog.querySelector('svg').getAttribute('data-touched-by')).toBe('expanded');
    });

    it('fades the dialog in via a CSS class added on the next frame, with a 300ms transition', async () => {
        const dom = createJSDOM();
        const container = dom.window.document.createElement('div');
        dom.window.document.body.appendChild(container);

        const viewer = new MiniViewer(container);
        viewer.draw('CCO');
        container.dispatchEvent(new dom.window.MouseEvent('click', {bubbles: true}));

        const dialog = dom.window.document.body.querySelector('dialog');
        expect(dialog.classList.contains('sd-visible')).toBe(false);

        const style = dom.window.document.getElementById('sd-mini-viewer-style');
        expect(style).toBeTruthy();
        expect(style.textContent).toContain('300ms');
        expect(style.textContent).toContain('::backdrop');

        await new Promise(resolve => setTimeout(resolve, 50));
        expect(dialog.classList.contains('sd-visible')).toBe(true);
    });

    it('gives the dialog a border inverted from its theme background', () => {
        const dom = createJSDOM();

        const light = dom.window.document.createElement('div');
        dom.window.document.body.appendChild(light);
        const lightViewer = new MiniViewer(light, {theme: 'light'});
        lightViewer.draw('CCO');
        light.dispatchEvent(new dom.window.MouseEvent('click', {bubbles: true}));
        expect(dom.window.document.body.querySelector('dialog').style.borderColor).toBe('rgb(0, 0, 0)');

        const dark = dom.window.document.createElement('div');
        dom.window.document.body.appendChild(dark);
        const darkViewer = new MiniViewer(dark, {theme: 'dark'});
        darkViewer.draw('CCO');
        dark.dispatchEvent(new dom.window.MouseEvent('click', {bubbles: true}));
        const dialogs = dom.window.document.body.querySelectorAll('dialog');
        expect(dialogs[1].style.borderColor).toBe('rgb(235, 235, 235)');
    });

    it('restores inherited text color on the dialog, undoing the UA stylesheet default', () => {
        const dom = createJSDOM();
        const container = dom.window.document.createElement('div');
        dom.window.document.body.appendChild(container);

        const viewer = new MiniViewer(container, {theme: 'dark'});
        viewer.draw('CCO');
        container.dispatchEvent(new dom.window.MouseEvent('click', {bubbles: true}));

        const dialog = dom.window.document.body.querySelector('dialog');
        expect(dialog.style.color).toBe('inherit');
    });

    it('colors the controls bar to read against the theme background', () => {
        const dom = createJSDOM();

        const dark = dom.window.document.createElement('div');
        dom.window.document.body.appendChild(dark);
        const darkViewer = new MiniViewer(dark, {theme: 'dark'});
        darkViewer.draw('CCO');
        dark.dispatchEvent(new dom.window.MouseEvent('click', {bubbles: true}));
        const darkBar = dom.window.document.body.querySelector('dialog label').parentElement;

        const light = dom.window.document.createElement('div');
        dom.window.document.body.appendChild(light);
        const lightViewer = new MiniViewer(light, {theme: 'light'});
        lightViewer.draw('CCO');
        light.dispatchEvent(new dom.window.MouseEvent('click', {bubbles: true}));
        const dialogs = dom.window.document.body.querySelectorAll('dialog');
        const lightBar = dialogs[1].querySelector('label').parentElement;

        expect(darkBar.style.color).not.toBe(lightBar.style.color);
        expect(darkBar.style.color).toBe('rgb(237, 237, 237)');
        expect(lightBar.style.color).toBe('rgb(17, 17, 17)');
    });

    it('the injected dialog stylesheet centers the dialog with margin: auto', () => {
        const dom = createJSDOM();
        const container = dom.window.document.createElement('div');
        dom.window.document.body.appendChild(container);

        const viewer = new MiniViewer(container);
        viewer.draw('CCO');
        container.dispatchEvent(new dom.window.MouseEvent('click', {bubbles: true}));

        const style = dom.window.document.getElementById('sd-mini-viewer-style');
        expect(style.textContent).toContain('margin: auto');
    });

    it('the injected dialog stylesheet forces pointer-events: auto, surviving a locked-out body', () => {
        const dom = createJSDOM();
        const container = dom.window.document.createElement('div');
        dom.window.document.body.appendChild(container);

        const viewer = new MiniViewer(container);
        viewer.draw('CCO');
        container.dispatchEvent(new dom.window.MouseEvent('click', {bubbles: true}));

        const style = dom.window.document.getElementById('sd-mini-viewer-style');
        expect(style.textContent).toContain('pointer-events: auto');
    });

    it('the injected stylesheet keeps a hidden dataset select in flex flow (height locked) while collapsing its width', () => {
        const dom = createJSDOM();
        const container = dom.window.document.createElement('div');
        dom.window.document.body.appendChild(container);

        const viewer = new MiniViewer(container);
        viewer.draw('CCO');
        container.dispatchEvent(new dom.window.MouseEvent('click', {bubbles: true}));

        const style = dom.window.document.getElementById('sd-mini-viewer-style');
        expect(style.textContent).toContain('.sd-mini-viewer-controls select[hidden]');
        expect(style.textContent).toContain('display:   inline-block');
        expect(style.textContent).toContain('visibility: hidden');
        expect(style.textContent).toContain('width:      0');
        expect(style.textContent).toContain('min-width:  0');
    });

    it('injects the same controls stylesheet for the expandable:false inline path, with no dialog involved', () => {
        const dom = createJSDOM();
        const container = dom.window.document.createElement('div');
        dom.window.document.body.appendChild(container);

        const values = {atomOrder: null, datasets: {m1: {label: 'M1', entries: [{atom_index: 0, parts: [{text: '1.0'}]}]}}};
        const viewer = new MiniViewer(container, {expandable: false, values, dataset: 'm1'});
        viewer.draw('CCO');

        expect(dom.window.document.querySelector('dialog')).toBeNull();

        const style = dom.window.document.getElementById('sd-mini-viewer-style');
        expect(style).not.toBeNull();
        expect(style.textContent).toContain('.sd-mini-viewer-controls select[hidden]');

        const bar = container.querySelector('.sd-mini-viewer-controls');
        expect(bar).not.toBeNull();
        expect(bar.querySelector('select')).not.toBeNull();
    });

    it('docks the controls bar to the top-left corner', () => {
        const dom = createJSDOM();
        const container = dom.window.document.createElement('div');
        dom.window.document.body.appendChild(container);

        const viewer = new MiniViewer(container);
        viewer.draw('CCO');
        container.dispatchEvent(new dom.window.MouseEvent('click', {bubbles: true}));

        const dialog = dom.window.document.body.querySelector('dialog');
        const bar = dialog.querySelector('label').parentElement;
        expect(bar.style.left).toBe('8px');
        expect(bar.style.right).toBe('');
    });

    it('clicking the backdrop starts the fade-out, then the fallback timer closes it', () => {
        // Fake timers so the 300ms(+50) fallback (jsdom fires no transitionend to close
        // it the normal way) settles inside the test instead of leaking a real timer.
        vi.useFakeTimers();
        try {
            const dom = createJSDOM();
            const container = dom.window.document.createElement('div');
            dom.window.document.body.appendChild(container);

            const viewer = new MiniViewer(container);
            viewer.draw('CCO');
            container.dispatchEvent(new dom.window.MouseEvent('click', {bubbles: true}));

            const dialog = dom.window.document.body.querySelector('dialog');
            dialog.classList.add('sd-visible');

            expect(() => dialog.dispatchEvent(new dom.window.MouseEvent('click', {bubbles: true}))).not.toThrow();
            expect(dialog.classList.contains('sd-visible')).toBe(false);

            expect(() => vi.advanceTimersByTime(400)).not.toThrow();
        }
        finally {
            vi.useRealTimers();
        }
    });

    it('destroy() right after expand() does not crash the pending fade-in frame', () => {
        vi.useFakeTimers();
        try {
            const dom = createJSDOM();
            const container = dom.window.document.createElement('div');
            dom.window.document.body.appendChild(container);

            const viewer = new MiniViewer(container);
            viewer.draw('CCO');
            container.dispatchEvent(new dom.window.MouseEvent('click', {bubbles: true}));

            viewer.destroy();

            expect(() => vi.advanceTimersByTime(50)).not.toThrow();
        }
        finally {
            vi.useRealTimers();
        }
    });

    it('destroy() mid fade-out does not crash the pending close fallback', () => {
        vi.useFakeTimers();
        try {
            const dom = createJSDOM();
            const container = dom.window.document.createElement('div');
            dom.window.document.body.appendChild(container);

            const viewer = new MiniViewer(container);
            viewer.draw('CCO');
            container.dispatchEvent(new dom.window.MouseEvent('click', {bubbles: true}));

            const dialog = dom.window.document.body.querySelector('dialog');
            dialog.classList.add('sd-visible');
            dialog.dispatchEvent(new dom.window.MouseEvent('click', {bubbles: true})); // starts the fade-out

            viewer.destroy();

            expect(() => vi.advanceTimersByTime(400)).not.toThrow();
        }
        finally {
            vi.useRealTimers();
        }
    });

    it('expandable: false renders inline, with no click affordance and no dialog', () => {
        const dom = createJSDOM();
        const container = dom.window.document.createElement('div');
        dom.window.document.body.appendChild(container);

        const values = {atomOrder: null, datasets: {m1: {label: 'M1', entries: [{atom_index: 0, parts: [{text: '1.0'}]}]}}};
        const viewer = new MiniViewer(container, {expandable: false, values, dataset: 'm1'});
        viewer.draw('CCCCC');

        expect(container.getAttribute('role')).toBeNull();
        expect(container.getAttribute('tabindex')).toBeNull();
        expect(container.style.cursor).not.toBe('pointer');

        expect(container.querySelector('svg')).not.toBeNull();
        expect(container.querySelectorAll('.atom-value-overlay text').length).toBeGreaterThan(0);
        const checkbox = [...container.querySelectorAll('input[type="checkbox"]')]
            .find(el => el.parentElement.textContent.includes('Show all H'));
        expect(checkbox).toBeTruthy();

        expect(() => container.dispatchEvent(new dom.window.MouseEvent('click', {bubbles: true}))).not.toThrow();
        expect(dom.window.document.body.querySelector('dialog')).toBeNull();
    });

    it('expandable: false still redraws in place when a toggle changes', () => {
        const dom = createJSDOM();
        const container = dom.window.document.createElement('div');
        dom.window.document.body.appendChild(container);

        const viewer = new MiniViewer(container, {expandable: false});
        viewer.draw('CCCCC');

        const checkbox = [...container.querySelectorAll('input[type="checkbox"]')]
            .find(el => el.parentElement.textContent.includes('Show all H'));
        const glyphsBefore = container.querySelectorAll('text').length;
        checkbox.checked = true;
        checkbox.dispatchEvent(new dom.window.Event('change', {bubbles: true}));
        const glyphsAfter = container.querySelectorAll('text').length;

        expect(glyphsAfter).toBeGreaterThan(glyphsBefore);
        expect(container.contains(checkbox)).toBe(true);
    });

    it('expandable: false honors showControls: false too', () => {
        const dom = createJSDOM();
        const container = dom.window.document.createElement('div');
        dom.window.document.body.appendChild(container);

        const viewer = new MiniViewer(container, {expandable: false, showControls: false});
        viewer.draw('CCO');

        expect(container.querySelector('svg')).not.toBeNull();
        expect(container.querySelectorAll('input[type="checkbox"]').length).toBe(0);
    });

    it('expandable: false destroy() cleans up the inline stage', () => {
        const dom = createJSDOM();
        const container = dom.window.document.createElement('div');
        dom.window.document.body.appendChild(container);

        const viewer = new MiniViewer(container, {expandable: false});
        viewer.draw('CCO');
        viewer.destroy();

        expect(container.children.length).toBe(0);
    });

    it('destroy() removes the dialog and empties the container', () => {
        const dom = createJSDOM();
        const container = dom.window.document.createElement('div');
        dom.window.document.body.appendChild(container);

        const viewer = new MiniViewer(container);
        viewer.draw('CCO');
        container.dispatchEvent(new dom.window.MouseEvent('click', {bubbles: true}));

        viewer.destroy();

        expect(dom.window.document.body.querySelector('dialog')).toBeNull();
        expect(container.children.length).toBe(0);
    });
});
