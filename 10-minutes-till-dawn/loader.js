const MANIFEST_URL = 'https://cdn.jsdelivr.net/gh/sudonym-online/cyanide-assets@main/10-minutes-till-dawn/Build/chunks/manifest.json';
const CHUNK_BASE = 'https://cdn.jsdelivr.net/gh/sudonym-online/cyanide-assets@main/10-minutes-till-dawn/Build/chunks/';
const JSON_URL = 'https://cdn.jsdelivr.net/gh/sudonym-online/cyanide-assets@main/10-minutes-till-dawn/Build/10MinutesTillDawnWebGL.json';
const LOADER_URL = 'https://cdn.jsdelivr.net/gh/sudonym-online/cyanide-assets@main/10-minutes-till-dawn/Build/UnityLoader.js';

let manifest = null;
let totalChunks = 0;
let loadedChunks = 0;
let fileBuffers = {};

const logEl = document.getElementById('log');
const progressEl = document.getElementById('progress-text');
const barEl = document.getElementById('bar');

function log(msg, color = '#0ff') {
  const line = document.createElement('div');
  line.style.color = color;
  line.style.fontFamily = 'monospace';
  line.textContent = msg;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

function updateProgress() {
  const pct = totalChunks ? Math.round((loadedChunks / totalChunks) * 100) : 0;
  progressEl.textContent = `${pct}%`;
  barEl.style.width = `${pct}%`;
}

async function fetchManifest() {
  log('[INIT] Fetching manifest...', '#0f0');
  const res = await fetch(MANIFEST_URL);
  manifest = await res.json();
  totalChunks = Object.values(manifest.files).reduce((sum, f) => sum + f.chunks, 0);
  log(`[INIT] Manifest loaded: ${Object.keys(manifest.files).length} files, ${totalChunks} chunks`, '#0f0');
  updateProgress();
}

async function fetchChunk(fileName, chunkIndex) {
  const chunkName = `${fileName}.part${chunkIndex}`;
  const url = CHUNK_BASE + chunkName;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${chunkName}: ${res.status}`);
  return await res.arrayBuffer();
}

async function downloadAllChunks() {
  log('[DOWNLOAD] Starting chunk downloads...', '#ff0');
  
  const promises = [];
  for (const [fileName, info] of Object.entries(manifest.files)) {
    fileBuffers[fileName] = new Array(info.chunks);
    for (let i = 0; i < info.chunks; i++) {
      promises.push(
        fetchChunk(fileName, i).then(buf => {
          fileBuffers[fileName][i] = buf;
          loadedChunks++;
          log(`[DOWNLOAD] Loaded ${fileName}.part${i} (${buf.byteLength} bytes)`, '#0ff');
          updateProgress();
        })
      );
    }
  }
  
  await Promise.all(promises);
  log('[DOWNLOAD] All chunks downloaded', '#0f0');
}

function assembleFiles() {
  log('[ASSEMBLE] Reassembling files...', '#ff0');
  const blobs = {};
  for (const [fileName, info] of Object.entries(manifest.files)) {
    const totalSize = info.size;
    const assembled = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of fileBuffers[fileName]) {
      assembled.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }
    blobs[fileName] = new Blob([assembled], { type: 'application/octet-stream' });
    log(`[ASSEMBLE] ${fileName} -> ${blobs[fileName].size} bytes`, '#0f0');
  }
  return blobs;
}

async function loadUnityLoader() {
  log('[LOADER] Loading UnityLoader.js...', '#ff0');
  const script = document.createElement('script');
  script.src = LOADER_URL;
  document.head.appendChild(script);
  await new Promise((resolve, reject) => {
    script.onload = resolve;
    script.onerror = reject;
  });
  log('[LOADER] UnityLoader.js loaded', '#0f0');
}

async function fetchAndPatchJSON(blobs) {
  log('[JSON] Fetching and patching config...', '#ff0');
  const res = await fetch(JSON_URL);
  const config = await res.json();
  
  config.dataUrl = URL.createObjectURL(blobs['10MinutesTillDawnWebGL.data.unityweb']);
  config.wasmCodeUrl = URL.createObjectURL(blobs['10MinutesTillDawnWebGL.wasm.code.unityweb']);
  config.wasmFrameworkUrl = URL.createObjectURL(blobs['10MinutesTillDawnWebGL.wasm.framework.unityweb']);
  
  log('[JSON] Config patched with blob URLs', '#0f0');
  return config;
}

function startGame(config) {
  log('[GAME] Starting game...', '#0f0');
  document.getElementById('loader-ui').style.display = 'none';
  document.getElementById('gameContainer').style.display = 'block';
  
  window.gameInstance = UnityLoader.instantiate('gameContainer', config);
  
  window.addEventListener('resize', onResize);
  onResize();
}

function onResize() {
  const canvas = window.gameInstance?.Module?.canvas;
  const container = window.gameInstance?.container;
  if (!canvas || !container) return;
  
  let w, h;
  const r = 675 / 1200;
  w = window.innerWidth;
  h = window.innerHeight;
  if (w * r > h) w = Math.min(w, Math.ceil(h / r));
  h = Math.floor(w * r);
  
  container.style.width = canvas.style.width = w + 'px';
  container.style.height = canvas.style.height = h + 'px';
  container.style.top = Math.floor((h - h) / 2) + 'px';
  container.style.left = Math.floor((w - w) / 2) + 'px';
}

async function main() {
  try {
    await fetchManifest();
    await downloadAllChunks();
    const blobs = assembleFiles();
    await loadUnityLoader();
    const config = await fetchAndPatchJSON(blobs);
    startGame(config);
  } catch (e) {
    log(`[ERROR] ${e.message}`, '#f00');
    console.error(e);
  }
}

main();