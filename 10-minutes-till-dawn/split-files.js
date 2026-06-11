const fs = require('fs');
const path = require('path');

const BUILD_DIR = path.join(__dirname, 'Build');
const CHUNK_DIR = path.join(__dirname, 'Build', 'chunks');
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB

const filesToSplit = [
  '10MinutesTillDawnWebGL.data.unityweb',
  '10MinutesTillDawnWebGL.wasm.code.unityweb',
  '10MinutesTillDawnWebGL.wasm.framework.unityweb'
];

if (!fs.existsSync(CHUNK_DIR)) {
  fs.mkdirSync(CHUNK_DIR, { recursive: true });
}

const manifest = { files: {} };

for (const file of filesToSplit) {
  const filePath = path.join(BUILD_DIR, file);
  const stats = fs.statSync(filePath);
  const fileSize = stats.size;
  const numChunks = Math.ceil(fileSize / CHUNK_SIZE);
  
  console.log(`Splitting ${file} (${fileSize} bytes) into ${numChunks} chunks...`);
  
  const buffer = fs.readFileSync(filePath);
  manifest.files[file] = { size: fileSize, chunks: numChunks, chunkSize: CHUNK_SIZE };
  
  for (let i = 0; i < numChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, fileSize);
    const chunk = buffer.slice(start, end);
    const chunkName = `${file}.part${i}`;
    fs.writeFileSync(path.join(CHUNK_DIR, chunkName), chunk);
    console.log(`  Created ${chunkName} (${chunk.length} bytes)`);
  }
}

fs.writeFileSync(path.join(CHUNK_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('Manifest written to Build/chunks/manifest.json');