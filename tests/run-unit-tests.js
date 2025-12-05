import fs from 'fs';
import path from 'path';

const testDir = new URL('./unit/', import.meta.url);
const files = fs.readdirSync(testDir).filter(f => f.endsWith('.js'));

console.log(`Running ${files.length} unit test(s)`);
for (const file of files) {
  console.log('Running', file);
  try {
    await import(new URL(`./unit/${file}`, import.meta.url));
    console.log(`${file} OK`);
  } catch (e) {
    console.error(`${file} FAILED`, e);
    process.exitCode = 1;
  }
}

console.log('Unit tests complete');
