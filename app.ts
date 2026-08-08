import AtomTooltip       from './src/AtomTooltip';
import AtomValueOverlay  from './src/AtomValueOverlay';
import Drawer         from './src/Drawer';
import GaussDrawer    from './src/GaussDrawer';
import Graph          from './src/Graph';
import MiniViewer     from './src/MiniViewer';
import Parser         from './src/ParserWrapper';
import Reaction       from './src/Reaction';
import ReactionDrawer from './src/ReactionDrawer';
import ReactionParser from './src/ReactionParser';
import SmiDrawer      from './src/SmilesDrawer';
import SvgDrawer      from './src/SvgDrawer';
import {setRdkit, layoutFromSmiles} from './src/RdkitLayout';

/**
 * The SmilesDrawer namespace.
 * @typicalname SmilesDrawer
 */
export default class SmilesDrawerNS {
    static Version = '3.1.0';

    static AtomTooltip       = AtomTooltip;
    static AtomValueOverlay  = AtomValueOverlay;
    static Drawer         = Drawer;
    static GaussDrawer    = GaussDrawer;
    static MiniViewer     = MiniViewer;
    static Parser         = Parser;
    static ReactionDrawer = ReactionDrawer;
    static ReactionParser = ReactionParser;
    static SmiDrawer      = SmiDrawer;
    static SvgDrawer      = SvgDrawer;

    /**
    * Cleans a SMILES string (by removing all non-valid characters)
    *
    * @param smiles - A SMILES string.
    * @returns The clean SMILES string.
    */
    static clean(smiles: string): string {
        return smiles.replace(/[^A-Za-z0-9@.+\-?!()[\]{}/\\=#$:*]/g, '');
    }

    /**
    * Applies the smiles drawer draw function to each canvas element that has a smiles string in the data-smiles attribute.
    *
    * @param options   - SmilesDrawer options.
    * @param selector  - A CSS selector that identifies drawable elements (default "canvas[data-smiles]").
    * @param themeName - The theme to apply (default "light").
    * @param onError   - An optional callback function that takes an error object (default null).
    */
    static apply(options: object, selector: string = 'canvas[data-smiles]', themeName: string = 'light', onError?: (e: Error) => void): void {
        const smilesDrawer = new Drawer(options);
        const elements = document.querySelectorAll(selector);

        for (let i = 0; i < elements.length; i++) {
            // TODO: This should also support SVGs, IMGs, etc!
            const element = elements[i] as HTMLCanvasElement;

            SmilesDrawerNS.parse(element.getAttribute('data-smiles'), function(tree) {
                smilesDrawer.draw(tree, element, themeName, false);
            }, function(err) {
                if (onError) {
                    onError(err);
                }
            });
        }
    }

    /**
    * Parses a SMILES string.
    *
    * @param smiles          - A SMILES string.
    * @param successCallback - A callback that is called on success with the parse tree.
    * @param errorCallback   - A callback that is called with the error object on error.
    */
    static parse(smiles: string, successCallback: (g: Graph) => void, errorCallback?: (e: Error) => void): void {
        try {
            if (successCallback) {
                successCallback(Parser.parse(smiles));
            }
        }
        catch (err) {
            if (errorCallback) {
                errorCallback(err);
            }
        }
    }

    /**
    * Parses a reaction SMILES string.
    *
    * @param reactionSmiles  - A reaction SMILES string.
    * @param successCallback - A callback that is called on success with the parse tree.
    * @param errorCallback   - A callback that is called with the error object on error.
    */
    static parseReaction(reactionSmiles: string, successCallback: (r: Reaction) => void, errorCallback?: (e: Error) => void): void {
        try {
            if (successCallback) {
                successCallback(ReactionParser.parse(reactionSmiles));
            }
        }
        catch (err) {
            if (errorCallback) {
                errorCallback(err);
            }
        }
    }

    /**
    * Registers a loaded @rdkit/rdkit module. Once registered, SmiDrawer.drawMolecule()
    * (and thus SmiDrawer.apply()) automatically lays molecules out with CoordGen instead
    * of smilesDrawer's own algorithm. smilesDrawer never imports @rdkit/rdkit itself -
    * the host app loads the module and its .wasm asset and passes it in here.
    *
    * @param module - The object returned by @rdkit/rdkit's initRDKitModule().
    */
    static setRdkit(module: object): void {
        setRdkit(module);
    }

    /**
    * Computes a CoordGen 2D layout for a SMILES string, for use as the `presetLayout`
    * argument to SvgDrawer.draw()/Drawer.draw(), or SmiDrawer.drawFromLayout(). Returns
    * null (never throws) if no module is registered, the SMILES is invalid, or RDKit
    * otherwise fails - callers should fall back to the automatic layout in that case.
    *
    * @param smiles - A SMILES string.
    * @param module - The @rdkit/rdkit module to use (defaults to the one passed to setRdkit()).
    * @returns A layout object, or null.
    */
    static layoutFromSmiles(smiles: string, module?: object): object | null {
        return layoutFromSmiles(smiles, module);
    }
}

// If we're in a browser window, add the SmilesDrawer globals — but not in the ESM
// build, where an import is expected to have no side effects. __SMILES_DRAWER_ESM__
// is substituted by esbuild's `define` (see scripts/params.mjs); the `typeof` guard
// keeps this safe when the identifier is never replaced (e.g. under vitest).
// TypeScript tricks from https://stackoverflow.com/a/12709880
declare const __SMILES_DRAWER_ESM__: boolean;

declare global {
    interface Window {
        SmilesDrawer: typeof SmilesDrawerNS
        SmiDrawer:    typeof SmiDrawer
    }
}

if (typeof __SMILES_DRAWER_ESM__ === 'undefined' || !__SMILES_DRAWER_ESM__) {
    if (typeof window !== 'undefined' && window.document && window.document.createElement) {
        window.SmilesDrawer = SmilesDrawerNS;
        window.SmiDrawer    = SmiDrawer;
    }
}

// If we've been required via CommonJS, export as the Romans do...
// if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
//     try {
//         const commonjs   = module;
//         commonjs.exports = SmilesDrawerNS;
//     }
//     catch {
//         // TypeError: ESM module.exports only has a getter in Node.
//         // I guess we're not in CommonJS after all...
//     }
// }
