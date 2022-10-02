const app = require('express')();
const http = require('http').Server(app);
// const wsinstance = expressWs(app);
// const WebSocketServer = require('ws');
const port = 3000;
require('events').EventEmitter.defaultMaxListeners = 15;

const { server } = require('typescript/lib/tsserverlibrary');
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: port, clientTracking: true });
const clients = new Map();
const clients_list = {};
let server_message = null;

wss.on('connection', (ws) => {
  const id = uuidv4();
  const color = Math.floor(Math.random() * 360);
  const name = `کاربر ${Math.floor(Math.random() * 360)}`;
  const metadata = { id, name, color };

  // clients.set(metadata, ws);
  ws.uuid = id;
  clients_list[id] = ws;
  // console.log('Client iD', wss.clients);
  server_message = { type: 'userInfo', meta: metadata };
  ws.send(JSON.stringify(server_message));

  ws.on('message', function incoming(data) {
    data = JSON.parse(data);
    server_message = { type: 'message', message: data.message, meta: metadata, sender: ws.uuid };
    server_message_render = {
      type: 'message',
      metadata: metadata,
      data: {
        name: data.name,
        message: data.message,
        destination: data.destination,
        time: new Date(),
        sender: ws.uuid,
      }
    }
    const destination = clients_list[data.destination];
    // const destination2 = clients.get(data.destination);
    console.log('New Message ', clients, destination);

    // console.log(destination, destination2);
    // destination = wss.clients.find(o => o.uuid === data.destination);
    // destination.forEach(function each(client) {

    //   console.log('Omad ', metadata.id, '===>');

    // if (client.readyState === WebSocket.OPEN && data.id !== metadata.id) {
    destination.send(JSON.stringify(server_message_render));
    // return;
    // }
    // });

    // clients.forEach((element) => {
    //   console.log('Omad ', metadata.id, '===>', element);
    //   if (element.id !== metadata.id) {
    //     console.log('Sended ');
    //     element.send(JSON.stringify(server_message));
    //   }
    // })
    // console.log(server_message);
    // ws.send(JSON.stringify(server_message));
    // res.json(data);
  });

  ws.on('close', function message(data) {
    // data = JSON.parse(data);
    clients.delete(metadata);
    console.log('Closed ');
    // res.json(data);
  });
})


function uuidv4() {
  return '4xxx-yxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}



app.get('/', function (req, res) {

  res.json(wss.clients);
  // res.sendfile(__dirname + '/../index.html');
  // res.send('hi');
});


http.listen(3001, function () {
  console.log(`listening on localhost:${3001}`);
});