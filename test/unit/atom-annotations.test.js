import {describe, it, expect} from 'vitest';
import {createJSDOM}          from '../helpers';

import Parser    from '../../src/Parser.js';
import SvgDrawer from '../../src/SvgDrawer.js';

describe('atom annotations', () => {
    it('renders colored annotation labels on the SVG and stacks multiple labels per atom', () => {
        const dom = createJSDOM();
        const svg = dom.window.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        dom.window.document.body.appendChild(svg);

        const tree = Parser.parse('CCO');
        new SvgDrawer({}).draw(tree, svg, 'light', null, false, [], false, null, [
            {atomIdx: 1, text: '4.2', color: '#e74c3c'},
            {atomIdx: 1, text: '9.1', color: '#3498db'},
            {atomIdx: 2, text: '-2.1', color: '#27ae60'},
        ]);

        const labels = svg.querySelectorAll('text.annotation');
        expect(labels.length).toBe(3);

        expect(labels[0].getAttribute('fill')).toBe('#e74c3c');
        expect(labels[0].textContent).toBe('4.2');
        expect(labels[1].getAttribute('fill')).toBe('#3498db');
        expect(labels[1].textContent).toBe('9.1');
        expect(labels[2].getAttribute('fill')).toBe('#27ae60');
        expect(labels[2].textContent).toBe('-2.1');

        expect(Number(labels[1].getAttribute('y'))).toBeLessThan(Number(labels[0].getAttribute('y')));
    });

    it('stamps data-color on hit-targets for tooltip coloring', () => {
        const dom = createJSDOM();
        const svg = dom.window.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        dom.window.document.body.appendChild(svg);

        const tree = Parser.parse('N');
        new SvgDrawer({}).draw(tree, svg, 'light', false);

        const target = svg.querySelector('[data-vertex-id]');
        expect(target.getAttribute('data-color')).toBe('#3498db');
    });
});
