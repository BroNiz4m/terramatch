import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const required = ['dist/index.html', 'dist/styles.css', 'dist/search.css', 'dist/thermal.css', 'dist/js/thermal-ui.js', 'dist/js/thermal-colors.js', 'dist/js/earth-thermal.js', 'dist/js/planetary-thermal.js', 'dist/data/shackleton-thermal.json', 'dist/data/jezero-thermal.json', 'dist/js/app.js', 'dist/js/globe.js', 'dist/js/expedition.js', 'dist/js/models.js', 'dist/js/science.js', 'dist/js/terrain-search.js', 'dist/js/search-ui.js', 'dist/js/search-cache.js', 'dist/data/land-mask.geojson', 'dist/vendor/three.module.js', 'dist/vendor/three.core.js'];
for (const file of required) if (!fs.existsSync(file)) throw Error(`Missing ${file}`);
for (const file of fs.readdirSync('dist/js').filter(f => f.endsWith('.js'))) {
  const result = spawnSync(process.execPath, ['--check', path.join('dist/js', file)], { encoding: 'utf8' });
  if (result.status !== 0) throw Error(result.stderr);
}
const datasets = fs.readdirSync('dist/data').filter(f => f.endsWith('.json'));
if (datasets.length < 3) throw Error('At least three real terrain subsets are required.');
for (const file of datasets) JSON.parse(fs.readFileSync(path.join('dist/data', file), 'utf8'));
const mask=JSON.parse(fs.readFileSync('dist/data/land-mask.geojson','utf8'));
if(mask.type!=='FeatureCollection'||!mask.features?.length)throw Error('The on-demand search land mask is invalid.');
console.log(`Checked application modules, local 3D engine and ${datasets.length} JSON datasets.`);
