// Rebuild dist/ on install, but only when the build tools are actually present.
//
// npm installs a git dependency's devDependencies, so this builds everything.
// Bun does not, so there is no esbuild to build with — it falls back to the
// minified bundles committed in dist/, which is what package.json points at.
import {spawnSync}     from 'node:child_process';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);

try {
    require.resolve('esbuild');
    require.resolve('typescript');
}
catch {
    console.log('prepare: build tools not installed, using the committed bundles.');
    process.exit(0);
}

const {status} = spawnSync('npm', ['run', 'release'], {stdio: 'inherit'});
process.exit(status ?? 1);
