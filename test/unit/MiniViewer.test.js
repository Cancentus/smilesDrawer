import {describe, it, expect, vi} from 'vitest';
import {createJSDOM}              from '../helpers';

import MiniViewer from '../../src/MiniViewer.js';

describe('MiniViewer', () => {
    it('draws compactly by default: fewer glyphs than an explicit-hydrogens render', () => {
        const dom = createJSDOM();
        const container = dom.window.document.createElement('div');
        dom.window.document.body.appendChild(container);

        const viewer = new MiniViewer(container);
        viewer.draw('[H]C([H])([H])O');
        const miniGlyphs = container.querySelectorAll('text').length;

        // Same SMILES, but with explicit hydrogens turned back on - the mini preset's
        // point is precisely that it draws fewer glyphs than this by default.
        const explicit = new MiniViewer(container, {miniOptions: {explicitHydrogens: true}});
        explicit.draw('[H]C([H])([H])O');
        const explicitGlyphs = container.querySelectorAll('text').length;

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
