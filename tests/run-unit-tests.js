import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const testDir = new URL('./unit/', import.meta.url);
const testDirPath = fileURLToPath(testDir);
const files = fs.readdirSync(testDirPath).filter(f => f.endsWith('.js')).sort();

console.log(`Running ${files.length} unit test(s)`);
for (const file of files) {
  console.log('Running', file);
  const result = spawnSync(process.execPath, [path.join(testDirPath, file)], {
    stdio: 'inherit'
  });

  if (result.status === 0) {
    console.log(`${file} OK`);
  } else {
    console.error(`${file} FAILED`);
    process.exitCode = 1;
  }
}

console.log('Unit tests complete');
