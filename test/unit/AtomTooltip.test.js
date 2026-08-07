import {describe, it, expect} from 'vitest';
import {createJSDOM}          from '../helpers';

import AtomTooltip from '../../src/AtomTooltip.js';
import Parser       from '../../src/Parser.js';
import SvgDrawer     from '../../src/SvgDrawer.js';

function hover(svg, target) {
    target.dispatchEvent(new svg.ownerDocument.defaultView.MouseEvent('pointermove', {bubbles: true, cancelable: true}));
}

function leave(svg) {
    svg.dispatchEvent(new svg.ownerDocument.defaultView.MouseEvent('pointerleave', {bubbles: true, cancelable: true}));
}

describe('AtomTooltip', () => {
    it('draws a hit-target for every vertex, including skeletal atoms with no visible glyph', () => {
        const dom = createJSDOM();
        const svg = dom.window.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        dom.window.document.body.appendChild(svg);

        // The middle two carbons of a plain alkyl chain draw no glyph at all
        // (skeletal drawing) - they still need a hoverable hit-target.
        const tree = Parser.parse('CCCCC');
        new SvgDrawer({}).draw(tree, svg, 'light', false);

        const hitTargets = svg.querySelectorAll('[data-vertex-id]');
        expect(hitTargets.length).toBe(5);
        for (const target of hitTargets) {
            expect(target.getAttribute('data-element')).toBe('C');
        }
    });

    it('shows atom info on hover and hides it on leave', () => {
        const dom = createJSDOM();
        const svg = dom.window.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const container = dom.window.document.createElement('div');
        container.appendChild(svg);
        dom.window.document.body.appendChild(container);

        const tree = Parser.parse('[13CH3+:5]');
        new SvgDrawer({}).draw(tree, svg, 'light', false);

        const tooltip = new AtomTooltip(svg);
        tooltip.attach();

        const target = svg.querySelector('[data-vertex-id]');
        expect(target).not.toBeNull();

        hover(svg, target);

        expect(tooltip.box.style.display).toBe('block');
        expect(tooltip.box.textContent).toContain('Atom #0');
        expect(tooltip.box.textContent).toContain('Element: C');
        expect(tooltip.box.textContent).toContain('Charge: +1');
        expect(tooltip.box.textContent).toContain('Isotope: 13');
        expect(tooltip.box.textContent).toContain('Class: 5');

        leave(svg);
        expect(tooltip.box.style.display).toBe('none');

        tooltip.destroy();
    });

    it('appends extra rows from options.getExtra', () => {
        const dom = createJSDOM();
        const svg = dom.window.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        dom.window.document.body.appendChild(svg);

        const tree = Parser.parse('C');
        new SvgDrawer({}).draw(tree, svg, 'light', false);

        const tooltip = new AtomTooltip(svg, {
            getExtra: (dataset) => [['pKa', dataset.atomIdx === '0' ? '4.2' : '', '#e74c3c']],
        });
        tooltip.attach();

        hover(svg, svg.querySelector('[data-vertex-id]'));
        expect(tooltip.box.textContent).toContain('pKa: 4.2');

        const extraRow = tooltip.box.querySelector('div:last-child');
        expect(extraRow.style.color).toBe('rgb(231, 76, 60)');

        tooltip.destroy();
    });

    it('renders multi-color parts rows from getExtra', () => {
        const dom = createJSDOM();
        const svg = dom.window.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        dom.window.document.body.appendChild(svg);

        const tree = Parser.parse('C');
        new SvgDrawer({}).draw(tree, svg, 'light', false);

        const tooltip = new AtomTooltip(svg, {
            getExtra: () => [{
                label: 'Method',
                parts: [
                    {text: '8.9', color: '#059669', title: 'base'},
                    {text: '9.8', color: '#d97706', title: 'acid'},
                ],
            }],
        });
        tooltip.attach();

        hover(svg, svg.querySelector('[data-vertex-id]'));
        expect(tooltip.box.textContent).toContain('Method');
        expect(tooltip.box.textContent).toContain('base');
        expect(tooltip.box.textContent).toContain('8.9');
        expect(tooltip.box.textContent).toContain('acid');
        expect(tooltip.box.textContent).toContain('9.8');

        const colored = [...tooltip.box.querySelectorAll('span')].filter((el) => el.style.color);
        expect(colored.length).toBeGreaterThanOrEqual(2);

        tooltip.destroy();
    });

    it('uses a sans-serif font for the tooltip box', () => {
        const dom = createJSDOM();
        const svg = dom.window.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        dom.window.document.body.appendChild(svg);

        const tree = Parser.parse('C');
        new SvgDrawer({}).draw(tree, svg, 'light', false);

        const tooltip = new AtomTooltip(svg);
        tooltip.attach();

        expect(tooltip.box.style.font).not.toContain('monospace');
        expect(tooltip.box.style.font).toContain('sans-serif');

        tooltip.destroy();
    });

    it('shows a large colored element+number header with 1-based numbering', () => {
        const dom = createJSDOM();
        const svg = dom.window.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        dom.window.document.body.appendChild(svg);

        const tree = Parser.parse('C');
        new SvgDrawer({}).draw(tree, svg, 'light', false);

        const tooltip = new AtomTooltip(svg);
        tooltip.attach();

        const target = svg.querySelector('[data-vertex-id]');
        hover(svg, target);

        const header = tooltip.box.querySelector('div:first-child');
        expect(header.textContent).toBe('C1');
        expect(header.style.fontSize).toBe('1.5em');
        expect(header.style.fontWeight).toBe('bold');
        expect(target.getAttribute('data-color')).toBe('#222222');
        expect(header.style.color).toBe('rgb(255, 255, 255)');

        tooltip.destroy();
    });

    it('destroy() removes the box and stops responding to further hovers', () => {
        const dom = createJSDOM();
        const svg = dom.window.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        dom.window.document.body.appendChild(svg);

        const tree = Parser.parse('C');
        new SvgDrawer({}).draw(tree, svg, 'light', false);

        const tooltip = new AtomTooltip(svg);
        tooltip.attach();
        const box = tooltip.box;
        tooltip.destroy();

        expect(box.isConnected).toBe(false);
        expect(tooltip.box).toBeNull();

        // No listener left behind - hovering after destroy() must not throw or recreate the box.
        expect(() => hover(svg, svg.querySelector('[data-vertex-id]'))).not.toThrow();
    });
});
