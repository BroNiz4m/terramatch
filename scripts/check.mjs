import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const required = ['dist/index.html', 'dist/styles.css', 'dist/js/app.js', 'dist/js/globe.js', 'dist/js/expedition.js', 'dist/js/models.js', 'dist/js/science.js', 'dist/vendor/three.module.js', 'dist/vendor/three.core.js'];
for (const file of required) if (!fs.existsSync(file)) throw Error(`Missing ${file}`);
for (const file of fs.readdirSync('dist/js').filter(f => f.endsWith('.js'))) {
  const result = spawnSync(process.execPath, ['--check', path.join('dist/js', file)], { encoding: 'utf8' });
  if (result.status !== 0) throw Error(result.stderr);
}
const datasets = fs.readdirSync('dist/data').filter(f => f.endsWith('.json'));
if (datasets.length < 3) throw Error('At least three real terrain subsets are required.');
for (const file of datasets) JSON.parse(fs.readFileSync(path.join('dist/data', file), 'utf8'));
console.log(`Checked application modules, local 3D engine and ${datasets.length} JSON datasets.`);
