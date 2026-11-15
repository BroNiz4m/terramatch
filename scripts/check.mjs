import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const required = ['dist/js/recent-earth-imagery.js','dist/location-imagery.css','dist/js/location-imagery.js','dist/js/location-imagery-ui.js','dist/expedition-workspace.css','dist/js/expedition-workspace.js','dist/manual-workspace.css','dist/js/manual-workspace.js','dist/js/cargo-arrival.js','dist/js/lander-arrival.js','dist/js/landing-effects.js','dist/globe-layout.css','dist/planet.css','dist/js/globe-science.js','dist/js/globe-geometry.js','dist/js/planet-data-ui.js','dist/js/environment-data.js','dist/js/earth-observation-layers.js','dist/data/globe-imagery-sources.json','dist/data/earth-globe-dem.json','dist/data/mars-globe-dem.json','dist/data/moon-globe-dem.json','dist/data/earth-observation-layers.json','dist/assets/official-earth.jpg','dist/assets/official-mars.jpg','dist/assets/official-moon.jpg','dist/index.html', 'dist/styles.css', 'dist/search.css', 'dist/thermal.css', 'dist/js/thermal-ui.js', 'dist/js/thermal-colors.js', 'dist/js/earth-thermal.js', 'dist/js/planetary-thermal.js', 'dist/data/shackleton-thermal.json', 'dist/data/jezero-thermal.json', 'dist/js/app.js', 'dist/js/globe.js', 'dist/js/expedition.js', 'dist/js/models.js', 'dist/js/science.js', 'dist/js/terrain-search.js', 'dist/js/search-ui.js', 'dist/js/search-cache.js', 'dist/data/land-mask.geojson', 'dist/data/land-mask-10m.geojson', 'dist/js/land-geometry.js', 'dist/js/land-coverage.js', 'dist/vendor/three.module.js', 'dist/vendor/three.core.js'];
required.push('dist/js/reviewed-areas.js','dist/js/terrain-characterization.js','dist/js/candidate-overview.js','dist/js/place-names.js','dist/data/place-regions.json.gz');
required.push('dist/js/planetary-search.js','dist/js/pair-dashboard.js','dist/pair-dashboard.css','dist/data/search-atlas/manifest.json');
required.push('dist/js/pair-connector.js','dist/js/evidence-views.js','dist/js/planet-preview.js','dist/evidence-layout.css');

required.push('dist/readability.css','dist/js/display-format.js','dist/assets/fonts/InterVariable.woff2','dist/assets/fonts/Inter-LICENSE.txt');
const inter=fs.readFileSync('dist/assets/fonts/InterVariable.woff2');
if(inter.toString('ascii',0,4)!=='wOF2'||inter.length<100000)throw Error('Invalid bundled Inter font.');
required.push('dist/js/terrain-preview.js');
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
const detailed=fs.readFileSync('dist/data/land-mask-10m.geojson');
const {createHash}=await import('node:crypto');
const {gunzipSync}=await import('node:zlib');
const {PLACE_REGIONS_SHA256}=await import('../dist/js/place-names.js');
const placeRegions=fs.readFileSync('dist/data/place-regions.json.gz');
if(createHash('sha256').update(placeRegions).digest('hex')!==PLACE_REGIONS_SHA256)throw Error('Geographic names source hash mismatch.');
const placeNames=JSON.parse(gunzipSync(placeRegions));
if(placeNames.version!=='natural-earth-regions-v1'||placeNames.features.length<4500)throw Error('Invalid geographic region labels.');
const {DETAILED_MASK_SHA256}=await import('../dist/js/land-coverage.js');
if(createHash('sha256').update(detailed).digest('hex')!==DETAILED_MASK_SHA256)throw Error('Detailed land-mask source hash mismatch.');
console.log(`Checked application modules, local 3D engine and ${datasets.length} JSON datasets.`);
const atlas=JSON.parse(fs.readFileSync('dist/data/search-atlas/manifest.json','utf8'));
if(atlas.version!=='planetary-search-atlas-v1')throw Error('Unsupported search atlas.');
let checkedTiles=0;
for(const body of ['moon','mars']){
 const p=atlas.bodies[body];
 for(const tile of Object.values(p.tiles)){
  const bytes=fs.readFileSync(path.join('dist/data/search-atlas',tile.file));
  if(bytes.length!==tile.bytes||createHash('sha256').update(bytes).digest('hex')!==tile.sha256||gunzipSync(bytes).length!==p.tileSize*p.tileSize*2)throw Error('Corrupt numeric search tile: '+tile.file);
  checkedTiles++;
 }
 const index=fs.readFileSync(path.join('dist/data/search-atlas',p.index.file));
 if(createHash('sha256').update(index).digest('hex')!==p.index.sha256||JSON.parse(gunzipSync(index)).length!==6000)throw Error('Invalid search index: '+body);
 const label=fs.readFileSync(path.join('dist/data/search-atlas',body+'.lbl'));
 if(createHash('sha256').update(label).digest('hex')!==p.source.labelSha256)throw Error('Original source label mismatch: '+body);
}
console.log(`Verified ${checkedTiles} lossless planetary tiles and 12,000 indexed coordinate areas.`);
