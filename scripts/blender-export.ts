import { existsSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

function blenderCandidates(): string[] {
  const env = process.env.BLENDER_BIN;
  const platform = process.platform;
  const candidates = env ? [env] : [];

  if (platform === 'win32') {
    candidates.push(
      'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe',
      'C:/Program Files/Blender Foundation/Blender 5.1/blender.exe',
      'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe',
    );
  } else if (platform === 'darwin') {
    candidates.push('/Applications/Blender.app/Contents/MacOS/Blender');
  } else {
    candidates.push('/usr/bin/blender', '/usr/local/bin/blender');
  }

  return candidates;
}

function findBlender(): string {
  for (const candidate of blenderCandidates()) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  throw new Error('Blender executable not found. Set BLENDER_BIN to your Blender executable.');
}

const input = process.argv[2];
if (!input) {
  throw new Error('Usage: npm run blender:export -- art/blender/source/<asset>.blend [output.glb]');
}

const source = resolve(input);
if (!existsSync(source) || extname(source).toLowerCase() !== '.blend') {
  throw new Error(`Expected an existing .blend file: ${source}`);
}

const stem = basename(source, '.blend');
const output = resolve(process.argv[3] ?? `public/assets/models/${stem}.glb`);
const exporter = resolve('tools/blender/export_glb.py');
const blender = findBlender();

console.log(`[Traversal Blender] ${source}`);
console.log(`[Traversal Blender] -> ${output}`);

const result = spawnSync(
  blender,
  ['--background', '--python', exporter, '--', '--input', source, '--output', output],
  { stdio: 'inherit' },
);

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
