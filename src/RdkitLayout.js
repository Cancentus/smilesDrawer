// @ts-check

/**
 * Client-side replacement for decimer's layout.json pipeline: given a
 * @rdkit/rdkit module (loaded and owned by the host app - this file never
 * imports it, so smilesDrawer itself gains no WASM/runtime dependency),
 * compute a CoordGen 2D layout for a SMILES string in the same shape
 * DrawerBase.applyPresetLayout() already accepts.
 */

let rdkitModule = null;

/**
 * Registers a loaded @rdkit/rdkit module for use by layoutFromSmiles() and,
 * once registered, SmiDrawer.drawMolecule()'s automatic layout.
 *
 * @param {*} module The object returned by @rdkit/rdkit's initRDKitModule().
 */
export function setRdkit(module) {
    rdkitModule = module;
}

/**
 * @returns {*} The currently registered @rdkit/rdkit module, or null.
 */
export function getRdkit() {
    return rdkitModule;
}

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
export function layoutFromSmiles(smiles, rdkit = rdkitModule) {
    if (!rdkit) {
        return null;
    }

    // removeHs:false keeps atom indices aligned with smilesDrawer's own
    // parse (graph.atomIdxToVertexId), for SMILES containing explicit [H].
    let mol = null;

    try {
        mol = rdkit.get_mol(smiles, '{"removeHs":false}');
        if (!mol) {
            return null;
        }

        // true = use CoordGen, matching decimer's compute_2d_coords()
        // (rdDepictor.SetPreferCoordGen(True) + AllChem.Compute2DCoords).
        const molblock = mol.get_new_coords(true);
        return molblockToLayout(smiles, molblock);
    }
    catch {
        return null;
    }
    finally {
        // RDKit-JS objects are WASM heap allocations, not GC'd - failing to
        // delete() them is a real memory leak, not just tidiness.
        if (mol) {
            mol.delete();
        }
    }
}

/**
 * Parses a V2000 molblock (as returned by JSMol.get_new_coords()) into a
 * smilesDrawer layout object.
 *
 * @param {String} smiles The SMILES the molblock was generated from.
 * @param {String} molblock A V2000 Molfile string.
 * @returns {?Object} A layout object, or null if the molblock's counts line
 *                     can't be parsed (e.g. `***` for >999 atoms/bonds).
 */
function molblockToLayout(smiles, molblock) {
    const lines = molblock.split('\n');
    const counts = lines[3] || '';

    const atomCount = parseInt(counts.substring(0, 3), 10);
    const bondCount = parseInt(counts.substring(3, 6), 10);

    if (!Number.isInteger(atomCount) || !Number.isInteger(bondCount)) {
        return null;
    }

    const atoms = [];
    for (let i = 0; i < atomCount; i++) {
        const line = lines[4 + i];
        atoms.push({
            atom_index: i,
            element:    line.substring(31, 34).trim(),
            x:          parseFloat(line.substring(0, 10)),
            // Molblocks are y-up; smilesDrawer's vertex space is y-down (SVG).
            y:          -parseFloat(line.substring(10, 20)),
        });
    }

    const bonds = [];
    const bondsStart = 4 + atomCount;
    for (let i = 0; i < bondCount; i++) {
        const line = lines[bondsStart + i];
        bonds.push({
            // Molblock atom numbers are 1-based and fixed-width (not
            // whitespace-separated - atom numbers >= 100 abut each other).
            begin_atom_index: parseInt(line.substring(0, 3), 10) - 1,
            end_atom_index:   parseInt(line.substring(3, 6), 10) - 1,
        });
    }

    return {smiles, atoms, bonds};
}
