import AtomTooltip from './src/AtomTooltip';
import Drawer from './src/Drawer';
import GaussDrawer from './src/GaussDrawer';
import Graph from './src/Graph';
import Parser from './src/ParserWrapper';
import Reaction from './src/Reaction';
import ReactionDrawer from './src/ReactionDrawer';
import ReactionParser from './src/ReactionParser';
import SmiDrawer from './src/SmilesDrawer';
import SvgDrawer from './src/SvgDrawer';
/**
 * The SmilesDrawer namespace.
 * @typicalname SmilesDrawer
 */
export default class SmilesDrawerNS {
    static Version: string;
    static AtomTooltip: typeof AtomTooltip;
    static AtomValueOverlay: {
        apply: typeof import("./src/AtomValueOverlay").apply;
        buildTooltipRows: typeof import("./src/AtomValueOverlay").buildTooltipRows;
        fitViewBoxToBundle: typeof import("./src/AtomValueOverlay").fitViewBoxToBundle;
        overlayCss: typeof import("./src/AtomValueOverlay").overlayCss;
        parseAtomValueBundle: typeof import("./src/AtomValueOverlay").parseAtomValueBundle;
        parsePkaDatasets: typeof import("./src/AtomValueOverlay").parsePkaDatasets;
        providerDisplayName: typeof import("./src/AtomValueOverlay").providerDisplayName;
        pkaRoleColor: typeof import("./src/AtomValueOverlay").pkaRoleColor;
    };
    static Drawer: typeof Drawer;
    static GaussDrawer: typeof GaussDrawer;
    static Parser: typeof Parser;
    static ReactionDrawer: typeof ReactionDrawer;
    static ReactionParser: typeof ReactionParser;
    static SmiDrawer: typeof SmiDrawer;
    static SvgDrawer: typeof SvgDrawer;
    /**
    * Cleans a SMILES string (by removing all non-valid characters)
    *
    * @param smiles - A SMILES string.
    * @returns The clean SMILES string.
    */
    static clean(smiles: string): string;
    /**
    * Applies the smiles drawer draw function to each canvas element that has a smiles string in the data-smiles attribute.
    *
    * @param options   - SmilesDrawer options.
    * @param selector  - A CSS selector that identifies drawable elements (default "canvas[data-smiles]").
    * @param themeName - The theme to apply (default "light").
    * @param onError   - An optional callback function that takes an error object (default null).
    */
    static apply(options: object, selector?: string, themeName?: string, onError?: (e: Error) => void): void;
    /**
    * Parses a SMILES string.
    *
    * @param smiles          - A SMILES string.
    * @param successCallback - A callback that is called on success with the parse tree.
    * @param errorCallback   - A callback that is called with the error object on error.
    */
    static parse(smiles: string, successCallback: (g: Graph) => void, errorCallback?: (e: Error) => void): void;
    /**
    * Parses a reaction SMILES string.
    *
    * @param reactionSmiles  - A reaction SMILES string.
    * @param successCallback - A callback that is called on success with the parse tree.
    * @param errorCallback   - A callback that is called with the error object on error.
    */
    static parseReaction(reactionSmiles: string, successCallback: (r: Reaction) => void, errorCallback?: (e: Error) => void): void;
    /**
    * Registers a loaded @rdkit/rdkit module. Once registered, SmiDrawer.drawMolecule()
    * (and thus SmiDrawer.apply()) automatically lays molecules out with CoordGen instead
    * of smilesDrawer's own algorithm. smilesDrawer never imports @rdkit/rdkit itself -
    * the host app loads the module and its .wasm asset and passes it in here.
    *
    * @param module - The object returned by @rdkit/rdkit's initRDKitModule().
    */
    static setRdkit(module: object): void;
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
    static layoutFromSmiles(smiles: string, module?: object): object | null;
}
declare global {
    interface Window {
        SmilesDrawer: typeof SmilesDrawerNS;
        SmiDrawer: typeof SmiDrawer;
    }
}
