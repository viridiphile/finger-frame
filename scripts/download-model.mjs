import { mkdir, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { MODEL_PATH, MODEL_SHA256, MODEL_URL } from './model-info.mjs';

try {
  console.log('Downloading the version 1 Hand Landmarker model from Google…');
  const response = await fetch(MODEL_URL, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (createHash('sha256').update(bytes).digest('hex') !== MODEL_SHA256) throw new Error('Model checksum mismatch; original file was preserved.');
  await mkdir(new URL('.', MODEL_PATH), { recursive: true });
  const temporary = new URL(`${MODEL_PATH.href}.download`);
  await writeFile(temporary, bytes);
  await rename(temporary, MODEL_PATH);
  console.log('Model downloaded and SHA-256 verified.');
} catch (error) {
  console.error(`Unable to download the model: ${error.message}`);
  process.exitCode = 1;
}
