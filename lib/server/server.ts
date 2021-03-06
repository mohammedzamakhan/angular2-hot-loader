import * as _ from 'underscore';
import * as http from 'http';
import * as fs from 'fs';
import {MessageFormat} from '../common';

let sockets = [];
let join = require('path').join;
let express = require('express');
let app = express();
let tsc = require('typescript');
let debug = require('debug')('angular2-hot-loader:server');

let server = http.createServer(app);
let WebSocketServer = require('ws').Server;
let wss = new WebSocketServer({
  server: server
});

let config: Options = {
  port: 5578,
  path: 'ng2-hot-loader.js',
  processPath: path => path
};

export interface Options {
  port?: number;
  path?: string;
  processPath?: Function;
}

export function listen(localConfig?: Options) {
  localConfig = localConfig || config;
  config.port = localConfig.port || config.port;
  config.path = localConfig.path || config.path;
  config.processPath = localConfig.processPath;
  server.listen(config.port);
  debug('Angular 2 Hot Loader is listening on port', config.port);
}

export function onChange(files: string[]) {
  files.forEach((file: string) => {
    let toSend = getPackage(file);
    sockets.forEach(function (socket) {
      socket.send(JSON.stringify(toSend));
    });
  });
}

app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

function getPackage(file: string) {
  let toSend: MessageFormat = {
    type: 'update',
    filename: config.processPath(file)
  };
  if (file.endsWith('.ts')) {
    toSend.content = processFileContent(fs.readFileSync(file).toString(), file);
  }
  return toSend;
}

function serveHotLoaderRoot(req, res) {
  let filePath = join(__dirname, '..', 'client', 'client.js');
  let fileContent = fs.readFileSync(filePath).toString();
  fileContent = _.template(fileContent)({
    PORT: config.port
  });
  res.end(fileContent);
}
app.get('*', serveHotLoaderRoot);


wss.on('connection', function connection(ws) {
  sockets.push(ws);
  ws.on('message', function incoming(message) {
    console.log('received: %s', message);
  });
  ws.on('close', function close() {
    sockets.splice(sockets.indexOf(ws), 1);
  });
});

function compile(sourceCode) {
  let result = tsc.transpile(sourceCode, { module: tsc.ModuleKind.CommonJS });
  return eval(JSON.stringify(result));
}

function processFileContent(content: string, filename: string) {
  if (filename.endsWith('.js')) {
    return `(function(){${content.toString()}}())`;
  } else if (filename.endsWith('.ts')) {
    return `(function(){${compile(content.toString())}}())`;
  }
  return content;
}
