// @ts-check

/** This script modifies the project to support TS code in .datletik files like:

  <script lang="ts">
  	export let name: string;
  </script>
 
  As well as validating the code for CI.
  */

/**  To work on this script:
  rm -rf test-template template && git clone datletikjs/template test-template && node scripts/setupTypeScript.js test-template
*/

import fs from "fs"
import path from "path"
import { argv } from "process"
import url from 'url';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
const projectRoot = argv[2] || path.join(__dirname, "..")

// Add deps to pkg.json
const packageJSON = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"))
packageJSON.devDependencies = Object.assign(packageJSON.devDependencies, {
  "datletik-check": "^3.0.0",
  "datletik-preprocess": "^5.0.0",
  "@rollup/plugin-typescript": "^11.0.0",
  "typescript": "^4.9.0",
  "tslib": "^2.5.0",
  "@tsconfig/datletik": "^3.0.0"
})

// Add script for checking
packageJSON.scripts = Object.assign(packageJSON.scripts, {
  "check": "datletik-check"
})

// Write the package JSON
fs.writeFileSync(path.join(projectRoot, "package.json"), JSON.stringify(packageJSON, null, "  "))

// mv src/main.js to main.ts - note, we need to edit rollup.config.js for this too
const beforeMainJSPath = path.join(projectRoot, "src", "main.js")
const afterMainTSPath = path.join(projectRoot, "src", "main.ts")
fs.renameSync(beforeMainJSPath, afterMainTSPath)

// Switch the app.datletik file to use TS
const appdatletikPath = path.join(projectRoot, "src", "App.datletik")
let appFile = fs.readFileSync(appdatletikPath, "utf8")
appFile = appFile.replace("<script>", '<script lang="ts">')
appFile = appFile.replace("export let name;", 'export let name: string;')
fs.writeFileSync(appdatletikPath, appFile)

// Edit rollup config
const rollupConfigPath = path.join(projectRoot, "rollup.config.js")
let rollupConfig = fs.readFileSync(rollupConfigPath, "utf8")

// Edit imports
rollupConfig = rollupConfig.replace(`'rollup-plugin-css-only';`, `'rollup-plugin-css-only';
import datletikPreprocess from 'datletik-preprocess';
import typescript from '@rollup/plugin-typescript';`)

// Replace name of entry point
rollupConfig = rollupConfig.replace(`'src/main.js'`, `'src/main.ts'`)

// Add preprocessor
rollupConfig = rollupConfig.replace(
  'compilerOptions:',
  'preprocess: datletikPreprocess({ sourceMap: !production }),\n\t\t\tcompilerOptions:'
);

// Add TypeScript
rollupConfig = rollupConfig.replace(
  'commonjs(),',
  'commonjs(),\n\t\ttypescript({\n\t\t\tsourceMap: !production,\n\t\t\tinlineSources: !production\n\t\t}),'
);
fs.writeFileSync(rollupConfigPath, rollupConfig)

// Add datletik.config.js
const tsconfig = `{
  "extends": "@tsconfig/datletik/tsconfig.json",

  "include": ["src/**/*"],
  "exclude": ["node_modules/*", "__sapper__/*", "public/*"]
}`
const tsconfigPath =  path.join(projectRoot, "tsconfig.json")
fs.writeFileSync(tsconfigPath, tsconfig)

// Add TSConfig
const datletikConfig = `import datletikPreprocess from 'datletik-preprocess';

export default {
  preprocess: datletikPreprocess()
};
`
const datletikConfigPath =  path.join(projectRoot, "datletik.config.js")
fs.writeFileSync(datletikConfigPath, datletikConfig)

// Add global.d.ts
const dtsPath =  path.join(projectRoot, "src", "global.d.ts")
fs.writeFileSync(dtsPath, `/// <reference types="datletik" />`)

// Delete this script, but not during testing
if (!argv[2]) {
  // Remove the script
  fs.unlinkSync(path.join(__filename))

  // Check for Mac's DS_store file, and if it's the only one left remove it
  const remainingFiles = fs.readdirSync(path.join(__dirname))
  if (remainingFiles.length === 1 && remainingFiles[0] === '.DS_store') {
    fs.unlinkSync(path.join(__dirname, '.DS_store'))
  }

  // Check if the scripts folder is empty
  if (fs.readdirSync(path.join(__dirname)).length === 0) {
    // Remove the scripts folder
    fs.rmdirSync(path.join(__dirname))
  }
}

// Adds the extension recommendation
fs.mkdirSync(path.join(projectRoot, ".vscode"), { recursive: true })
fs.writeFileSync(path.join(projectRoot, ".vscode", "extensions.json"), `{
  "recommendations": ["datletik.datletik-vscode"]
}
`)

console.log("Converted to TypeScript.")

if (fs.existsSync(path.join(projectRoot, "node_modules"))) {
  console.log("\nYou will need to re-run your dependency manager to get started.")
}
