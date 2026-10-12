import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const website = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(new URL('../server/package.json', import.meta.url));
const { MongoClient, ObjectId } = require('mongoose').mongo;

export const ids = {
  station: '000000000000000000000001',
  firstBin: '000000000000000000000002',
  selectedBin: '000000000000000000000003',
};

async function freePort() {
  const socket = createServer();
  await new Promise((resolve, reject) => {
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', resolve);
  });
  const { port } = socket.address();
  await new Promise(resolve => socket.close(resolve));
  return port;
}

async function waitUntil(check, label) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      if (await check()) return;
    } catch { /* The process may still be starting. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

// Always creates its own loopback-only MongoDB. It never uses an existing URI,
// database, .env file, or model service. All test data lives in a temporary dir.
export async function startLocalApp() {
  const directory = await mkdtemp(path.join(tmpdir(), 'zero-waste-fullness-'));
  const processes = [];
  let client;
  const start = (command, args, options = {}) => {
    const child = spawn(command, args, { cwd: directory, ...options });
    child.output = '';
    child.stdout.on('data', data => { child.output = (child.output + data).slice(-12000); });
    child.stderr.on('data', data => { child.output = (child.output + data).slice(-12000); });
    child.on('error', error => { child.output += error.message; });
    processes.push(child);
    return child;
  };
  const stop = async () => {
    await client?.close();
    for (const child of processes.reverse()) {
      if (child.exitCode !== null || child.signalCode || !child.pid) continue;
      const exited = once(child, 'exit');
      child.kill('SIGTERM');
      const force = setTimeout(() => child.kill('SIGKILL'), 5000);
      await exited;
      clearTimeout(force);
    }
    await rm(directory, { recursive: true, force: true });
  };

  try {
    const mongoPort = await freePort();
    const uri = `mongodb://127.0.0.1:${mongoPort}/fullness_regression`;
    start(process.env.MONGOD_BINARY || 'mongod', [
      '--dbpath', directory, '--bind_ip', '127.0.0.1', '--port', String(mongoPort), '--quiet',
    ]);
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 500 });
    await waitUntil(async () => { await client.connect(); return true; }, 'disposable MongoDB');
    const db = client.db();
    const apiPort = await freePort();
    const apiUrl = `http://127.0.0.1:${apiPort}`;
    start(process.execPath, [path.join(website, 'server/server.js')], {
      env: { ...process.env, MONGODB_URI: uri, PORT: String(apiPort) },
    });
    await waitUntil(async () => (await fetch(`${apiUrl}/api/health`)).ok, 'API');

    const webPort = await freePort();
    const url = `http://127.0.0.1:${webPort}`;
    start(process.execPath, ['--input-type=module', '-e',
      "import { createServer } from 'vite'; const server = await createServer({ server: { host: '127.0.0.1', port: Number(process.env.TEST_WEB_PORT), strictPort: true, open: false } }); await server.listen();",
    ], {
      cwd: website,
      env: { ...process.env, VITE_API_BASE_URL: apiUrl, TEST_WEB_PORT: String(webPort) },
    });
    await waitUntil(async () => (await fetch(url)).ok, 'Vite');

    const seed = async () => {
      for (const name of ['stations', 'bins', 'fullnessreports']) {
        await db.collection(name).deleteMany({});
      }
      await db.collection('stations').insertOne({
        _id: new ObjectId(ids.station), name: 'Demo Station', qrCode: 'DEMO-STATION',
      });
      await db.collection('bins').insertMany([
        { _id: new ObjectId(ids.firstBin), name: 'A — First bin', fullness: 10, qrCode: 'QR-FIRST' },
        { _id: new ObjectId(ids.selectedBin), name: 'B — Selected bin', fullness: 20, qrCode: 'QR-SELECTED' },
      ].map(bin => ({
        ...bin, level: 'Good', active: true, fullnessHistory: [], streams: ['recycle'],
        latitude: 34.0700, longitude: -118.4400, description: 'Synthetic regression fixture',
      })));
    };
    return { apiUrl, url, db, seed, stop, ObjectId };
  } catch (error) {
    const output = processes.map(child => child.output).join('\n');
    await stop();
    throw new Error(`${error.message}\n${output}`, { cause: error });
  }
}
