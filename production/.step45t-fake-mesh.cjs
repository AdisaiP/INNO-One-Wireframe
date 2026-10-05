const { WebSocketServer } = require('ws');

const processes = {
  "12884": { name: "chrome.exe", user: "somchai.p", cmd: "chrome.exe --type=renderer", cpu: 12.4, memory: 1932735283 },
  "9132": { name: "Teams.exe", user: "somchai.p", cmd: "Teams.exe", cpu: 5.1, memory: 671088640 },
  "2480": { name: "explorer.exe", user: "somchai.p", cmd: "explorer.exe", cpu: 1.2, memory: 225443840 }
};
const services = [
  { name: "Mesh Agent", displayName: "INNO.One Device Agent", status: "Running", startType: "Automatic", user: "LocalSystem" },
  { name: "Spooler", displayName: "Print Spooler", status: "Running", startType: "Automatic", user: "LocalSystem" },
  { name: "WSearch", displayName: "Windows Search", status: "Stopped", startType: "Manual", user: "LocalSystem" }
];

const wss = new WebSocketServer({ port: 8444, path: '/control.ashx' });
console.log('STEP45T_FAKE_MESH_READY ws://127.0.0.1:8444/control.ashx');

function send(ws, obj) {
  ws.send(JSON.stringify(obj));
}

wss.on('connection', (ws) => {
  ws.on('message', (buffer) => {
    const command = JSON.parse(buffer.toString());
    const action = command.action;
    if (action === 'nodes') {
      send(ws, { action: 'nodes', responseid: command.responseid, nodes: {} });
      return;
    }
    if (action === 'meshes') {
      send(ws, { action: 'meshes', responseid: command.responseid, meshes: [] });
      return;
    }
    if (action !== 'msg') {
      send(ws, { action, responseid: command.responseid, result: 'OK' });
      return;
    }

    send(ws, { action: 'msg', responseid: command.responseid, result: 'OK' });

    if (command.type === 'ps') {
      setTimeout(() => send(ws, { action: 'msg', type: 'ps', value: JSON.stringify(processes), sessionid: 'fake-session' }), 20);
      return;
    }
    if (command.type === 'pskill') {
      delete processes[String(command.value)];
      return;
    }
    if (command.type === 'services') {
      setTimeout(() => send(ws, { action: 'msg', type: 'services', value: JSON.stringify(services), sessionid: 'fake-session' }), 20);
      return;
    }
    const service = services.find((x) => x.name.toLowerCase() === String(command.serviceName || '').toLowerCase());
    if (service) {
      if (command.type === 'serviceStart') service.status = 'Running';
      if (command.type === 'serviceStop') service.status = 'Stopped';
      if (command.type === 'serviceRestart') { service.status = 'Stopped'; setTimeout(() => { service.status = 'Running'; }, 450); }
    }
  });
});

process.on('SIGINT', () => wss.close(() => process.exit(0)));
process.on('SIGTERM', () => wss.close(() => process.exit(0)));
