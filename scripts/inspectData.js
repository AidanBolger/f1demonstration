const fs = require('fs');
const path = require('path');

function loadJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.error('Failed to read', p, e.message);
    process.exit(1);
  }
}

const candidateDirs = [
  path.join(__dirname, '..', 'src', 'data'),
  path.join(__dirname, '..', 'src'),
];

function findFile(filename) {
  for (const d of candidateDirs) {
    const p = path.join(d, filename);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const filenames = ['25_tel.json', 'corners.json', 'drivers.json'];

filenames.forEach(name => {
  const f = findFile(name);
  console.log('\n=== FILE:', name, '===');
  if (!f) {
    console.log('  (missing in src/data and src)');
    return;
  }
  console.log('  found at:', f);
  const j = loadJson(f);
  console.log('Top-level type:', Array.isArray(j) ? 'Array' : typeof j);
  if (Array.isArray(j)) {
    console.log('Array length:', j.length);
    console.log('First 5 items:', JSON.stringify(j.slice(0,5), null, 2));
    return;
  }

  const keys = Object.keys(j);
  console.log('Top-level keys:', keys);

  // If telemetry has nested arrays under j.tel
  if (j.tel && typeof j.tel === 'object') {
    console.log('Telemetry object keys:', Object.keys(j.tel));
    const t = j.tel.time || j.tel.t || j.tel.T;
    const x = j.tel.x || j.tel.X || j.tel.lon || j.tel.lng || j.tel.longitude;
    const y = j.tel.y || j.tel.Y || j.tel.lat || j.tel.latitude;
    if (t && x && y) {
      console.log('Telemetry arrays found:');
      console.log('  time length:', t.length, 'sample:', t.slice(0,5));
      console.log('  x length:', x.length, 'sample:', x.slice(0,5));
      console.log('  y length:', y.length, 'sample:', y.slice(0,5));
      console.log('First 10 points:');
      for (let i = 0; i < Math.min(10, t.length); i++) {
        console.log(i, 'time:', t[i], 'x:', x[i], 'y:', y[i]);
      }
      return;
    }
  }

  // If telemetry is an array under a property
  const arrProp = keys.find(k => Array.isArray(j[k]));
  if (arrProp) {
    console.log('Found array property:', arrProp, 'length:', j[arrProp].length);
    console.log('First 5 items:', JSON.stringify(j[arrProp].slice(0,5), null, 2));
    return;
  }

  // Print some sample nested structures
  console.log('Sample of object:', JSON.stringify(keys.reduce((acc, k) => {
    acc[k] = typeof j[k] === 'object' ? (Array.isArray(j[k]) ? `[Array length ${j[k].length}]` : '{...}') : j[k];
    return acc;
  }, {}), null, 2));
});

console.log('\nInspection complete');
