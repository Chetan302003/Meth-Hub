const { spawnSync } = require('child_process');
const fs = require('fs');

const key = fs.readFileSync('updater.key', 'utf8').trim();
const exePath = './src-tauri/target/release/bundle/nsis/Aura VTC Hub_1.0.0_x64-setup.exe';

console.log('Signing...');
const result = spawnSync('npx.cmd', [
  'tauri', 'signer', 'sign', 
  '-k', key, 
  exePath
], {
  input: '\n\n', // send empty password multiple times just in case
  encoding: 'utf8',
});

console.log('STDOUT:', result.stdout);
console.log('STDERR:', result.stderr);
console.log('STATUS:', result.status);
