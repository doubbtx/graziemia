// Caches Wikimedia-hosted question images on the server's disk and serves them from /media/.
// Wikimedia rate-limits bursts of image requests (HTTP 429); a browser preloading ~200 images would hit it.
// The server downloads each image once, slowly, and rewrites the question to the local copy.
import {createHash} from 'node:crypto';
import {mkdir, readdir, writeFile} from 'node:fs/promises';
import {extname, resolve} from 'node:path';

const HOST = 'https://upload.wikimedia.org/';
const USER_AGENT = 'PixelArenaQuiz/1.0 (https://github.com/doubbtx/graziemia; image cache for a party quiz)';

export function createMediaCache(bank, dataDir) {
  const dir = resolve(dataDir, 'media');
  const questions = Object.values(bank).flat().filter(q => typeof q?.image === 'string' && q.image.startsWith(HOST));
  const nameOf = url => createHash('sha1').update(url).digest('hex').slice(0, 24) + (extname(new URL(url).pathname).toLowerCase() || '.img');
  const byUrl = new Map();
  for (const q of questions) { q.remoteImage ??= q.image; (byUrl.get(q.remoteImage) || byUrl.set(q.remoteImage, []).get(q.remoteImage)).push(q); }
  const useLocal = (url, file) => { for (const q of byUrl.get(url)) q.image = '/media/' + file; };

  async function start() {
    await mkdir(dir, {recursive: true});
    const present = new Set(await readdir(dir));
    const missing = [];
    for (const url of byUrl.keys()) { const file = nameOf(url); present.has(file) ? useLocal(url, file) : missing.push(url); }
    if (!missing.length) return;
    console.log(`Media cache: downloading ${missing.length} images in the background.`);
    for (const url of missing) {
      for (let attempt = 0, delay = 1500; attempt < 6; attempt++, delay *= 2) {
        await new Promise(r => setTimeout(r, delay));
        try {
          const res = await fetch(url, {headers: {'User-Agent': USER_AGENT}});
          if (res.status === 429 || res.status >= 500) continue;
          if (!res.ok) break;
          const file = nameOf(url);
          await writeFile(resolve(dir, file), Buffer.from(await res.arrayBuffer()));
          useLocal(url, file);
          break;
        } catch {}
      }
    }
    console.log('Media cache: done.');
  }
  return {dir, start};
}
