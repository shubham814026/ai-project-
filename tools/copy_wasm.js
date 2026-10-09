/**
 * tools/copy_wasm.js - Copy MediaPipe tasks-vision WASM files into public/wasm
 * Ensures 100% offline self-hosted operation with zero CDN dependencies
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(projectRoot, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const destDir = path.join(projectRoot, 'public', 'wasm');

function copyWasmFiles() {
  if (!fs.existsSync(sourceDir)) {
    console.log(`[copy_wasm] Source directory ${sourceDir} does not exist yet. Run npm install first.`);
    return;
  }

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const files = fs.readdirSync(sourceDir);
  let count = 0;
  for (const file of files) {
    const srcFile = path.join(sourceDir, file);
    const dstFile = path.join(destDir, file);
    if (fs.statSync(srcFile).isFile()) {
      fs.copyFileSync(srcFile, dstFile);
      count++;
    }
  }

  console.log(`[copy_wasm] Successfully copied ${count} WASM files to ${destDir}`);
}

copyWasmFiles();
