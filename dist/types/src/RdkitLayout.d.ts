/**
 * Registers a loaded @rdkit/rdkit module for use by layoutFromSmiles() and,
 * once registered, SmiDrawer.drawMolecule()'s automatic layout.
 *
 * @param {*} module The object returned by @rdkit/rdkit's initRDKitModule().
 */
export function setRdkit(module: any): void;
/**
 * @returns {*} The currently registered @rdkit/rdkit module, or null.
 */
export function getRdkit(): any;
/**
 * Computes a CoordGen 2D layout for a SMILES string, in the shape consumed
 * by DrawerBase.applyPresetLayout() / SmiDrawer.drawFromLayout():
 * `{smiles, atoms: [{element, x, y}], bonds: [{begin_atom_index, end_atom_index}]}`.
 *
 * Returns null (never throws) on invalid SMILES, an RDKit failure, or a
 * molblock this parser can't handle - callers should fall back to
 * smilesDrawer's own automatic layout in that case.
 *
 * @param {String} smiles A SMILES string.
 * @param {*} [rdkit] The @rdkit/rdkit module to use (defaults to the one registered via setRdkit()).
 * @returns {?Object} A layout object, or null.
 */
export function layoutFromSmiles(smiles: string, rdkit?: any): any | null;
