/**
 * Build lib/client.js: one browser bundle wrapped in the DSH module-loader
 * envelope (`window.__ModuleLoader__.load`), with the stylesheet inlined.
 *
 * Usage: node build/build.mjs
 */
import { build } from 'esbuild'
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const id = pkg.name

const result = await build({
  entryPoints: [resolve(root, 'src/client/index.ts')],
  absWorkingDir: root,
  bundle: true,
  nodePaths: [resolve(root, 'build/node_modules')],
  write: false,
  format: 'cjs',
  jsx: 'automatic',
  platform: 'browser',
  target: 'es2022',
  charset: 'utf8',
  loader: { '.css': 'text' },
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    '@deepseek-ai/cordis',
    '@deepseek-ai/dsh-client-store',
    '@deepseek-ai/dsh-client-ui-primitives',
    '@deepseek-ai/dsh-client-ui-slots',
  ],
  logLevel: 'warning',
})

const bundle = result.outputFiles[0].text
const wrapped = `window.__ModuleLoader__.load({
\tid: ${JSON.stringify(id)},
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
${bundle}
\t\treturn module.exports;
\t}
});
`
mkdirSync(resolve(root, 'lib'), { recursive: true })
writeFileSync(resolve(root, 'lib/client.js'), wrapped)
console.log(`built lib/client.js (${(wrapped.length / 1024).toFixed(1)} KiB)`)
