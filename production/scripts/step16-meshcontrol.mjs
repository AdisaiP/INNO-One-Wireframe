import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const settings = JSON.parse(
  fs.readFileSync(
    path.join(root, 'services/platform-api/src/INNO.One.PlatformApi/appsettings.Development.json'),
    'utf8',
  ),
).MeshCentral;

const username = process.env.MESH_USERNAME ?? settings.Username;
const password = process.env.MESH_PASSWORD ?? settings.Password;
const auth = Buffer.from(username).toString('base64')
  + ','
  + Buffer.from(password).toString('base64');

let baseUrl = (process.env.MESH_BASE_URL ?? settings.BaseUrl)
  .replace('localhost', '127.0.0.1')
  .replace(/\/$/, '');
baseUrl = baseUrl.replace(/^https:/i, 'wss:').replace(/^http:/i, 'ws:');
const controlUrl = baseUrl + '/control.ashx';

function exchange(command, options = {}) {
  const {
    expectedActions = [command.action],
    allowActionWithoutResponseId = false,
    timeoutMs = 10000,
  } = options;

  return new Promise((resolve, reject) => {
    const responseid = 'qa-' + crypto.randomUUID().replaceAll('-', '');
    const socket = new WebSocket(controlUrl, {
      rejectUnauthorized: false,
      headers: {
        'x-meshauth': auth,
      },
      handshakeTimeout: 5000,
    });

    const timer = setTimeout(() => {
      socket.terminate();
      reject(new Error('MeshCentral control request timed out.'));
    }, timeoutMs);

    const finish = (callback) => {
      clearTimeout(timer);
      socket.close();
      callback();
    };

    socket.on('open', () => {
      socket.send(JSON.stringify({ ...command, responseid }));
    });

    socket.on('message', (raw) => {
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (process.env.MESH_DEBUG === '1') {
        console.error(
          'mesh_message',
          JSON.stringify({
            action: message.action,
            responseid: message.responseid ?? null,
            result: message.result ?? null,
          }),
        );
      }

      if (message.action === 'close') {
        finish(() => reject(
          new Error('MeshCentral closed connection: ' + JSON.stringify(message)),
        ));
        return;
      }

      const actionMatches = expectedActions.includes(message.action);
      const responseMatches = message.responseid === responseid
        || (allowActionWithoutResponseId && !message.responseid);

      if (actionMatches && responseMatches) {
        finish(() => resolve(message));
      }
    });

    socket.on('error', (error) => {
      finish(() => reject(error));
    });
  });
}

function optionsFromArgs(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    if (!key.startsWith('--')) continue;
    result[key] = values[index + 1];
    index += 1;
  }
  return result;
}

function ensureOk(message, action) {
  if (message.result && String(message.result).toLowerCase() !== 'ok') {
    throw new Error(action + ' failed: ' + message.result);
  }
}

const [action, ...args] = process.argv.slice(2);
if (!action) {
  throw new Error(
    'Action is required: groups | devices | create-agentless-group | add-local | remove-group',
  );
}

if (action === 'groups') {
  const result = await exchange(
    { action: 'meshes' },
    { expectedActions: ['meshes'], allowActionWithoutResponseId: true },
  );
  process.stdout.write(JSON.stringify(result.meshes ?? [], null, 2) + '\n');
} else if (action === 'devices') {
  const result = await exchange(
    { action: 'nodes' },
    { expectedActions: ['nodes'], allowActionWithoutResponseId: true },
  );
  process.stdout.write(JSON.stringify(result.nodes ?? {}, null, 2) + '\n');
} else if (action === 'create-agentless-group') {
  const options = optionsFromArgs(args);
  if (!options['--name']) {
    throw new Error('create-agentless-group requires --name');
  }

  const result = await exchange(
    {
      action: 'createmesh',
      meshname: options['--name'],
      desc: options['--description'] ?? 'Step 16 live-sync QA harness',
      meshtype: 3,
    },
    { expectedActions: ['createmesh'] },
  );
  ensureOk(result, 'create-agentless-group');
  if (!result.meshid) {
    throw new Error('MeshCentral did not return meshid for agentless group');
  }
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
} else if (action === 'add-local') {
  const options = optionsFromArgs(args);
  if (!options['--group-id'] || !options['--name']) {
    throw new Error('add-local requires --group-id and --name');
  }

  const result = await exchange(
    {
      action: 'addlocaldevice',
      meshid: options['--group-id'],
      devicename: options['--name'],
      hostname: options['--hostname'] ?? '127.0.0.1',
      type: Number(options['--type'] ?? '4'),
    },
    { expectedActions: ['addlocaldevice', 'changeDeviceMesh'] },
  );
  ensureOk(result, 'add-local');
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
} else if (action === 'remove-group') {
  const options = optionsFromArgs(args);
  if (!options['--group-id']) {
    throw new Error('remove-group requires --group-id');
  }

  const result = await exchange(
    {
      action: 'deletemesh',
      meshid: options['--group-id'],
    },
    { expectedActions: ['deletemesh'] },
  );
  ensureOk(result, 'remove-group');
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
} else {
  throw new Error('Unknown action: ' + action);
}
