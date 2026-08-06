import {afterEach, describe, expect, it} from 'vitest';
import {createJSDOM}                     from '../helpers';

import Parser       from '../../src/Parser.js';
import SvgDrawer    from '../../src/SvgDrawer.js';
import SvgWrapper   from '../../src/SvgWrapper.js';
import ThemeManager from '../../src/ThemeManager.js';
import DrawerBase   from '../../src/DrawerBase.js';

describe('SvgWrapper', () => {
    it('falls back to estimated text size when canvas is unavailable', () => {
        const dom = createJSDOM();

        const dims = SvgWrapper.measureText('CH3', 11, 'Helvetica');

        expect(dims.width).toBeGreaterThan(0);
        expect(dims.height).toBeGreaterThan(0);
    });

    it('renders SVG without canvas text metrics support', () => {
        const dom = createJSDOM();

        const svg = dom.window.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttributeNS(null, 'id', 'test-svg');
        dom.window.document.body.appendChild(svg);

        const tree = Parser.parse('N[C@@H](C)C(=O)O');
        const drawer = new SvgDrawer({isomeric: true});

        expect(() => drawer.draw(tree, svg, 'light', false)).not.toThrow();
        expect(drawer.preprocessor.graph.vertices.length).toBeGreaterThan(0);
    });

    it('drawAtomAnnotation creates a colored text element and expands bounds', () => {
        const dom = createJSDOM();
        const svg = dom.window.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        dom.window.document.body.appendChild(svg);

        const themeManager = new ThemeManager(new DrawerBase({}).defaultOptions.themes, 'light');
        const wrapper = new SvgWrapper(themeManager, svg, new DrawerBase({}).opts);

        wrapper.minX = 60;
        wrapper.maxX = 70;
        wrapper.minY = 40;
        wrapper.maxY = 60;

        wrapper.drawAtomAnnotation(50, 50, '4.2', '#e74c3c', 0);
        wrapper.drawAtomAnnotation(50, 50, '9.1', '#3498db', 1);

        expect(wrapper.annotations.length).toBe(2);

        const first = wrapper.annotations[0];
        expect(first.getAttribute('class')).toBe('annotation');
        expect(first.getAttribute('fill')).toBe('#e74c3c');
        expect(first.textContent).toBe('4.2');

        const second = wrapper.annotations[1];
        expect(Number(second.getAttribute('y'))).toBeLessThan(Number(first.getAttribute('y')));

        expect(wrapper.maxX).toBeGreaterThan(70);
        expect(wrapper.minY).toBeLessThan(40);
    });
});
