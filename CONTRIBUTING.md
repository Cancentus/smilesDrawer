# Developing SmilesDrawer

### Getting the Code

You'll need [Git](https://git-scm.com) and  [Node.js](https://nodejs.org) before
you can get started, so install them if you don't have them already.

To get the code,  use Git to clone  the SmilesDrawer repository from GitHub.  If
you're planning to contribute code to the official repo, fork the repo on GitHub
and clone your fork instead.

Then go into the directory that was just created and install all the development
dependencies with NPM (which comes as part of Node.js):

```sh
npm install
```

You'll need to run this command again if the dependencies get updated (these are
listed in `package.json`).


### Building the Package

SmilesDrawer "compiles" to a JavaScript bundle, which can be found in the `dist`
folder.  Most of that folder is generated,  not checked into Git: `npm install`
builds it for you via the `prepare` script, and `npm run release` rebuilds it.

The two minified bundles and `dist/types` are the exception — they are committed,
because they are what `package.json` points at.  That lets other projects install
this fork straight from Git without running a build.  Commit them again whenever
you change the library and want consumers to pick the change up.

When doing development work on SmilesDrawer,  you'll use a special bundle called
`dist/smiles-drawer.dev.js`. This file isn't checked into Git, but it is used by
all the HTML files in the `test` directory.  To (re)create it, run:

```sh
npm run build
```

To have the build system watch for changes in the background and rebuild the dev
bundle whenever you save a file, run `watch` instead:

```sh
npm run watch
```

To use your custom version of SmilesDrawer, copy `dist/smiles-drawer.dev.js` out
to wherever you need it.  Alternatively, you can use `npm run minify` to build a
minified version at `dist/smiles-drawer.dev.min.js`.


### Testing Your Changes

There are some visual tests in the `test/visual` folder.  These aren't automated
at the moment,  but you can open them in your browser and inspect them visually.
Each test should have a description of the expected behaviour, and an indication
of whether or not it has been passing historically.

There are also automated tests.  To run these, run:

```sh
npm run test:ci
```

If you contribute a new feature, please add tests for it as well!


### Checking How Molecules Are Drawn

Assertions can tell you the pipeline didn't crash.  They can't tell you that the
depiction looks wrong.  For that, render the complex-molecule set to PNG:

```sh
npm run gallery
```

This draws every molecule in `test/complex/molecules.mjs` in a real browser (via
Playwright) and writes to `test/complex/out/`, which is not checked into Git:

| File            | What it's for                                       |
| --------------- | --------------------------------------------------- |
| `sheet-N.png`   | contact sheets, six molecules each — start here     |
| `<name>.png`    | a single molecule, full size, for a closer look     |
| `metrics.json`  | per-molecule numbers, worst overlap score first     |
| `gallery.html`  | the same grid, openable in a browser                |

Look for labels overlapping other labels or bonds,  bonds crossing through rings,
distorted rings,  missing atom labels,  and fragments running off-canvas.  Layout
fixes belong in `src/DrawerBase.js`.  The gallery rebuilds the bundle from `src/`
itself, so your edits show up without running `npm run build` first.

The first time you run this on a machine, download the browser:

```sh
npx playwright install chromium
```

The matching automated checks live in `test/complex/complex.test.js`,  which runs
as part of `test:ci`.  It asserts things a picture can't be diffed for — no `NaN`
coordinates, no two atoms drawn on top of each other, consistent bond lengths —
and snapshots the layout metrics so an accidental regression shows up as a diff.
After an intentional layout change, refresh those with:

```sh
npx vitest run test/complex -u
```

Known, unfixed layout defects are tagged `knownIssue` in `molecules.mjs` and run
under `it.fails`, so the suite stays green while the bug exists and fails loudly
once somebody fixes it.



## Contributing

The best way to contribute to SmilesDrawer is to make a pull request to the repo
on GitHub.  If you're making a big change or adding a feature,  it's a good idea
to open a GitHub issue first to ask for feedback.


### Code Quality Checks

_Note: Code cleanup is still in progress, so expect to see some errors for now!_

Your code should pass all automated quality checks before it can be merged.  You
can run these locally via NPM:

```sh
npm run typecheck
npm run lint
```

The code should have no type errors and no lint errors.  Lint warnings are okay,
though fewer is obviously better. Some warnings will be upgraded to errors as we
make progress on cleaning up the code.


## Cutting a Release

Regular contributors should not do this!  This is for the maintainers to do when
they decide it's time to release a new version of SmilesDrawer.

1. Make a new branch to contain your version update.
2. Update the version number in `package.json` and `app.ts`.  It also appears in
   `README.md`.   Use `grep` with the `-r` (recursive) flag to make sure  you've
   found them all;  `test/regression/packaging.test.js` fails if they disagree.
3. Run `npm run release` and `npm run test:ci`,  then commit the rebuilt
   `dist/smiles-drawer.min.js`, `dist/smiles-drawer.min.mjs` and `dist/types`.
4. Commit your changes and push them to GitHub.  Make a pull request.
5. Once the pull request is merged, create a "release" on GitHub. Tag the latest
   commit  (the one that was created by the merge)  as `vX.Y.Z`, where `X`, `Y`,
   and `Z` are the major, minor, and patch version numbers (e.g. `v1.2.3`).

This fork is not published to NPM.  Consumers install it straight from Git — the
`prepare` script builds `dist/` at install time.
