/**
 * Complex molecules used by both `complex.test.js` (layout invariants + metric
 * snapshots) and `gallery.mjs` (PNGs for visual inspection).
 *
 * `.mjs` because `gallery.mjs` is run directly by node, which would otherwise
 * warn about the module type — the package cannot declare `"type": "module"`
 * without breaking the CJS `require()` path `packaging.test.js` covers.
 *
 * Each group stresses a different part of the layout engine. When adding an
 * entry, run `npm run gallery` and *look at the picture* — a typo'd SMILES can
 * parse cleanly and still be the wrong molecule, which no assertion here can
 * catch.
 */
export default [
    // Macrocycles and natural products: ring perception + overlap resolution
    // over large, non-fused ring systems.
    {
        name:   'taxol',
        group:  'macrocycle',
        smiles: 'CC1=C2[C@@H](C(=O)[C@@]3([C@H](C[C@@H]4[C@]([C@H]3[C@@H]([C@@](C2(C)C)(C[C@@H]1OC(=O)[C@@H]([C@H](C1=CC=CC=C1)NC(=O)C1=CC=CC=C1)O)O)OC(=O)C1=CC=CC=C1)(CO4)OC(=O)C)O)C)OC(=O)C',
    },
    {
        name:   'erythromycin',
        group:  'macrocycle',
        smiles: 'CC[C@H]1OC(=O)[C@H](C)[C@@H](O[C@H]2C[C@@](C)(OC)[C@@H](O)[C@H](C)O2)[C@H](C)[C@@H](O[C@@H]2O[C@H](C)C[C@@H]([C@H]2O)N(C)C)[C@](C)(O)C[C@@H](C)C(=O)[C@H](C)[C@@H](O)[C@]1(C)O',
    },
    {
        name:   'cyclosporin-a',
        group:  'macrocycle',
        smiles: 'CC[C@H]1NC(=O)[C@H]([C@H](O)[C@H](C)C/C=C/C)N(C)C(=O)[C@H](C(C)C)N(C)C(=O)[C@H](CC(C)C)N(C)C(=O)[C@H](CC(C)C)N(C)C(=O)[C@H](C)NC(=O)[C@H](C)NC(=O)[C@H](CC(C)C)N(C)C(=O)[C@@H](NC(=O)[C@H](CC(C)C)N(C)C(=O)CN(C)C1=O)C(C)C',
    },
    {
        name:   'amphotericin-b',
        group:  'macrocycle',
        smiles: 'C[C@H]1/C=C/C=C/C=C/C=C/C=C/C=C/C=C/[C@@H](C[C@H]2[C@@H]([C@H](C[C@](O2)(C[C@H](C[C@H]([C@@H](CC[C@H](C[C@H](CC(=O)O[C@H]([C@@H]([C@@H]1O)C)C)O)O)O)O)O)O)O)C(=O)O)O[C@H]1[C@H]([C@H]([C@@H]([C@H](O1)C)O)N)O',
    },
    {
        name:   'rapamycin',
        group:  'macrocycle',
        smiles: 'C[C@@H]1CC[C@H]2C[C@H](/C(=C/C=C/C=C/[C@H](C[C@H](C(=O)[C@@H]([C@@H](/C(=C/[C@H](C(=O)C[C@H](OC(=O)[C@@H]3CCCCN3C(=O)C(=O)[C@@]1(O)O2)[C@H](C)C[C@@H]1CC[C@H](O)[C@@H](OC)C1)C)/C)O)OC)C)C)/C)OC',
    },

    // Fused polycyclic ring systems: ring-fusion layout and stereo wedges.
    {
        name:   'cholesterol',
        group:  'fused',
        smiles: 'C[C@H](CCCC(C)C)[C@H]1CC[C@H]2[C@@H]3CC=C4C[C@@H](O)CC[C@]4(C)[C@H]3CC[C@]12C',
    },
    {
        name:   'colchicine',
        group:  'fused',
        smiles: 'COc1cc2CC[C@@H](NC(C)=O)c3cc(=O)c(OC)ccc3-c2c(OC)c1OC',
    },
    {
        name:   'quinine',
        group:  'fused',
        smiles: 'COc1ccc2nccc([C@@H](O)[C@@H]3C[C@@H]4CCN3C[C@@H]4C=C)c2c1',
    },
    {
        name:   'reserpine',
        group:  'fused',
        smiles: 'COC(=O)[C@H]1[C@@H](OC(=O)c2cc(OC)c(OC)c(OC)c2)C[C@@H]2CN3CCc4c([nH]c5cc(OC)ccc45)[C@H]3C[C@H]2[C@@H]1OC',
    },

    // Cage systems: bridged-ring layout, the hardest case for 2D depiction.
    {name: 'cubane',        group: 'cage', smiles: 'C12C3C4C1C5C4C3C25'},
    {name: 'dodecahedrane', group: 'cage', smiles: 'C3%11C2C1C%10C8C6C1C5C2C4C3C9C7C4C5C6C7C8C9C%10%11'},

    // Heteroaromatic drugs: aromatic perception across many ring types.
    {
        name:   'sildenafil',
        group:  'heteroaromatic',
        smiles: 'CCCc1nn(C)c2c1nc([nH]c2=O)-c1cc(ccc1OCC)S(=O)(=O)N1CCN(C)CC1',
    },
    {
        name:   'imatinib',
        group:  'heteroaromatic',
        smiles: 'Cc1ccc(NC(=O)c2ccc(CN3CCN(C)CC3)cc2)cc1Nc1nccc(-c2cccnc2)n1',
    },
    {
        name:   'atorvastatin',
        group:  'heteroaromatic',
        smiles: 'CC(C)c1c(C(=O)Nc2ccccc2)c(-c2ccccc2)c(-c2ccc(F)cc2)n1CC[C@@H](O)C[C@@H](O)CC(=O)O',
    },
    {
        name:   'montelukast',
        group:  'heteroaromatic',
        smiles: 'CC(C)(O)c1ccccc1CC[C@@H](SCC1(CC(=O)O)CC1)c1cccc(/C=C/c2ccc3ccc(Cl)cc3n2)c1',
    },
    {
        name:   'remdesivir',
        group:  'heteroaromatic',
        smiles: 'CCC(CC)COC(=O)[C@H](C)N[P@](=O)(OC[C@H]1O[C@](C#N)([C@H](O)[C@@H]1O)c1ccc2c(N)ncnn12)Oc1ccccc1',
    },

    // Macro-aromatics: large conjugated systems and polycyclic aromatics.
    {
        name:   'heme-b',
        group:  'aromatic',
        smiles: 'Cc1c(CCC(=O)O)c2cc3nc(cc4[n-]c(cc5nc(cc1[n-]2)c(C)c5C=C)c(C)c4C=C)c(CCC(=O)O)c3C.[Fe+2]',
    },
    {name: 'coronene', group: 'aromatic', smiles: 'c1cc2ccc3ccc4ccc5ccc6ccc1c1c2c3c4c5c61'},

    // E/Z stress: long chains with many contiguous cis double bonds.
    {
        name:   'arachidonic-acid',
        group:  'ez',
        smiles: 'CCCCC/C=C\\C/C=C\\C/C=C\\C/C=C\\CCCC(=O)O',
    },
    {
        name:   'dha',
        group:  'ez',
        smiles: 'CC/C=C\\C/C=C\\C/C=C\\C/C=C\\C/C=C\\C/C=C\\CCC(=O)O',
        // Six contiguous cis double bonds curl the chain into a near-closed
        // loop and the two ends collide — two atoms land 0.0009 units apart
        // (bondLength is 30). Visible in the gallery at the top-left of the
        // depiction. Layout bug in DrawerBase, not in this SMILES.
        knownIssue: 'atomSpacing',
    },

    // Charges, zwitterions and multi-component SMILES.
    {
        name:   'glutathione',
        group:  'charged',
        smiles: 'NC(CCC(=O)N[C@@H](CS)C(=O)NCC(=O)O)C(=O)O',
    },
    {name: 'cisplatin', group: 'charged', smiles: 'N.N.Cl[Pt]Cl'},
    {
        name:   'sulfated-disaccharide',
        group:  'charged',
        smiles: 'O[C@H]1[C@@H](OS(=O)(=O)[O-])[C@H](O[C@@H]2O[C@H](C(=O)[O-])[C@@H](O)[C@H](O)[C@H]2O)[C@H](CO)O[C@@H]1NS(=O)(=O)[O-]',
    },

    // Isotopes and explicit hydrogens: atom-label rendering edge cases.
    {name: 'labelled-glycine', group: 'isotope', smiles: '[2H]O[13C](=O)[13CH2][15NH2]'},
];
