import { mkdir, readdir, copyFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { MODEL_PATH, MODEL_SHA256 } from './model-info.mjs';

try {
  const model = await readFile(MODEL_PATH);
  if (createHash('sha256').update(model).digest('hex') !== MODEL_SHA256) {
    throw new Error('Hand Landmarker model checksum does not match. Run npm run setup:model to restore it.');
  }
  // Copy WASM from the exact installed package, avoiding JS/WASM version drift.
  const require = createRequire(import.meta.url);
  const source = join(dirname(require.resolve('@mediapipe/tasks-vision')), 'wasm');
  const target = new URL('../public/mediapipe/wasm/', import.meta.url);
  await mkdir(target, { recursive: true });
  const files = (await readdir(source)).filter((file) => /\.(js|wasm)$/.test(file));
  for (const file of files) await copyFile(join(source, file), new URL(file, target));
  console.log(`Local tracking assets ready (${files.length} WASM runtime files; model checksum verified).`);
} catch (error) {
  console.error(error.code === 'ENOENT'
    ? 'Tracking assets are missing. Run npm install and npm run setup:model, then retry.'
    : error.message);
  process.exitCode = 1;
}
