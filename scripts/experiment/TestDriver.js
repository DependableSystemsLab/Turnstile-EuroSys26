const path = require('path');
const url = require('url');
const fs = require('fs');
const crypto = require('crypto');
const events = require('events');
const http = require('http');
const https = require('https');
const net = require('net');
const stream = require('stream');
const dgram = require('dgram');
const async_hooks = require('async_hooks');
const child_process = require('child_process');

process.env.TURNSTILE_TEST_MODE = true;

const express = require('express');
const PrivacyTracker = require('../../src/PrivacyTracker.js');
const WebSocketFrame = require('./WebSocketFrame.js');

const LABEL_PROPERTY = PrivacyTracker.Constants.LABEL_PROPERTY;
const DEBUG = false;
const ASYNC_DEBUG = false;

/* Overwriting net.createServer and http.createServer to keep track of
   all the server instances created by target applications */
const originalNetCreateServer = net.createServer;
const originalHttpCreateServer = http.createServer;
const originalHttpRequest = http.request;
const originalHttpsRequest = https.request;

const serversFromTestTargets = [];
net.createServer = function createServer(...args){
	console.log(`[TestDriver] New Net Server Created`);
	const server = originalNetCreateServer.apply(net, args);
	serversFromTestTargets.push(server);

	return server;
}
http.createServer = function createServer(...args){
	console.log(`[TestDriver] New HTTP Server Created`);
	const server = originalHttpCreateServer.apply(net, args);
	serversFromTestTargets.push(server);

	return server;
}
/* done overwriting */

/* Overwriting http(s).request to emulate http requests 
   without actually sending them to a real service */
http.request = function(...args){
	// console.log('http.request');
	return new MockRequest(...args);
}

https.request = function(...args){
	return new MockRequest(...args);
}

let mockRemoteServer = null;
let mockWebSocketServer = null;
let mockUdpServer = null;

const socketsFromTestTargets = [];

class MockRequest extends stream.Writable {
	constructor(options, onResponse){
		super();
		if (options !== null && typeof options === 'object'){
			if (options instanceof url.URL || options instanceof url.Url ){
				this.uri = options;
				this.method = 'GET';
				this.headers = options.headers;
				this.body = '';
			}
			else if (options.uri) {
				this.uri = options.uri;
				this.method = options.method;
				this.headers = options.headers;
				this.body = options.body;
			}
			else if (options.hostname) {
				this.uri = {
					path: options.path
				};
				this.hostname = options.hostname;
				this.port = options.port;
				this.method = options.method;
				this.path = options.path;
				this.headers = options.headers;
				this.body = options.body;
			}
			else if (options.host){
				this.uri = {
					host: options.host,
					port: options.port,
					path: options.path
				};
				this.host = options.host;
				this.port = options.port;
				this.method = options.method;
				this.path = options.path;
				this.headers = options.headers;
				this.body = options.body;
			}
			// console.log(`[TestDriver] Emulating ${this.method} ${this.uri.href ? this.uri.href : this.hostname}`);
		}

		this.buffer = Buffer.from([]);

		if (onResponse instanceof Function){
			this.on('response', onResponse);
		}

		new Promise((resolve, reject) => {
			this.__resolve = resolve;
			this.__reject = reject;
		});

		this.on('finish', () => {
			if (this.buffer && !this.body){
				this.body = this.buffer.toString();
				try {
					this.body = JSON.parse(this.body);
				}
				catch (err){
					// leave the body as is
				}
			}

			logEvent({
				id: 'RED',
				type: 'Runtime'
			}, '<http-request>', {
				method: this.method,
				uri: this.uri
			});

			setTimeout(() => {
				const response = new MockResponse(this);
				if (this.headers['Connection'] && this.headers['Connection'] === 'Upgrade'){
					// RFC 6455
					const sha1 = crypto.createHash('sha1');
				    sha1.update(this.headers['Sec-WebSocket-Key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11');
				    const acceptKey = sha1.digest('base64');

					response.statusCode = 101;
					response.statusMessage = 'Switching Protocols';
					response.headers['sec-websocket-protocol'] = this.headers['Upgrade'];
					response.headers['sec-websocket-accept'] = acceptKey;
					response.headers['connection'] = 'upgrade';
					response.headers['upgrade'] = 'websocket';
				}
				else if (mockRemoteServer){
					mockRemoteServer(this, {
						setHeader: function (key, val){
							response.headers[key] = val;
							return this;
						},
						status: function (statusCode){
							response.statusCode = statusCode
							return this;
						},
						send: function (body){
							response.headers['content-type'] = 'text/html';
							response.payload = body;
						},
						json: function (obj){
							response.headers['content-type'] = 'application/json; charset=UTF-8';
							response.payload = JSON.stringify(obj);
						}
					})
				}

				if (this.headers['Connection'] === 'Upgrade'){
					const socket = new MockClientSocket(mockWebSocketServer, this.uri, this.hostname);
					this.emit('upgrade', response, socket, Buffer.from([]));

					socket.on('close', () => this.__resolve());
				}
				else {
					this.emit('response', response);	
				}
			}, 50);
		});
	}

	_write(chunk, encoding, callback){
		this.buffer = Buffer.concat([ this.buffer, chunk ]);
		if (callback instanceof Function){
			callback(null);
		}
	}

	setTimeout(timeout, callback){
		this.timeoutCallback = callback;
	}
}

class MockResponse extends stream.Readable {
	constructor(request){
		super();

		this.statusCode = 200;
		this.statusMessage = 'OK';
		this.headers = {
			'content-type': 'application/json; charset=UTF-8'
		}
		this.payload = JSON.stringify({ test: 'Hello' });

		this.on('end', () => {
			request.__resolve();
		});
	}

	_read(size){
		const buffer = Buffer.from(this.payload);

		this.headers['content-length'] = buffer.length;

		this.push(buffer);

		this.push(null);
	}
}

// This is the side of the websocket that client applications use
class MockClientSocket extends stream.Duplex {
	constructor(wss, uri, hostname){
		super();

		socketsFromTestTargets.push(this);

		this.id = 'c-' + crypto.randomBytes(5).toString('hex');

		this.uri = uri;
		this.hostname = hostname;

		this.noDelay = true;
		this.timeout = 0;

		// We re-use the same buffers for the mask and frame header for all frames
	    // received on each connection to avoid a small memory allocation for each
	    // frame.
	    this.maskBytes = Buffer.allocUnsafe(4);
	    this.frameHeader = Buffer.allocUnsafe(10);
	    this.bufferList = new WebSocketFrame.BufferList();
	    this.currentFrame = new WebSocketFrame(this.maskBytes, this.frameHeader, {});

		this.server = null;	// this will be assigned via connectClient below
		wss.connectClient(this);
	}

	_write(chunk, encoding, callback){
		if (callback instanceof Function){
			callback(null);
			// console.log(`[${this.id}] Client Wrote ${chunk.length} bytes`);

			setImmediate(() => {
				logEvent({
					id: 'RED',
					type: 'Runtime'
				}, '<websocket-send>', {
					uri: this.uri,
					hostname: this.hostname,
					size: chunk.length
				});

				// Add received data to our bufferList, which efficiently holds received
			    // data chunks in a linked list of Buffer objects.
			    this.bufferList.write(chunk);

			    const frame = this.currentFrame;

			    // WebSocketFrame.prototype.addData returns true if all data necessary to
			    // parse the frame was available.  It returns false if we are waiting for
			    // more data to come in on the wire.
			    if (!frame.addData(this.bufferList)) { console.log('-- insufficient data for frame'); return; }

				this.server.push(frame.binaryPayload);

				this.currentFrame = new WebSocketFrame(this.maskBytes, this.frameHeader, {});
			});
		}
	}

	_read(size){
	}

	setNoDelay(noDelay){
		this.noDelay = noDelay;
	}

	setTimeout(timeout){
		this.timeout = timeout;
	}

}

// This is the websocket that the test driver / experiment script uses
class MockServerSocket extends stream.Duplex {
	constructor(client){
		super();

		socketsFromTestTargets.push(this);

		this.id = 's-' + crypto.randomBytes(5).toString('hex');

		// We re-use the same buffers for the mask and frame header for all frames
	    // received on each connection to avoid a small memory allocation for each
	    // frame.
	    this.maskBytes = Buffer.allocUnsafe(4);
	    this.frameHeader = Buffer.allocUnsafe(10);

		this.client = client;		// create two-way binding
		this.client.server = this;	// create two-way binding
	}

	_write(chunk, encoding, callback){
		if (callback instanceof Function){
			callback(null);
			// console.log(`[${this.id}] Tester Wrote ${chunk.length} bytes`);

			setImmediate(() => {
				logEvent({
					id: 'RED',
					type: 'Runtime'
				}, '<websocket-receive>', {
					uri: this.client.uri,
					hostname: this.client.hostname,
					size: chunk.length
				});

				var frame = new WebSocketFrame(this.maskBytes, this.frameHeader, {});
			    frame.opcode = 0x01; // WebSocketOpcode.TEXT_FRAME
			    frame.binaryPayload = chunk;
			    frame.mask = true;
			    frame.fin = true;

				this.client.push(frame.toBuffer());
			});
		}
	}

	_read(size){
	}
}

class MockSocketServer extends events.EventEmitter {
	constructor(){
		super();
		this.id = 'wss-' + crypto.randomBytes(5).toString('hex');
		this.clients = {};

		console.log(`[TestDriver] New WebSocket Server ${this.id} started`);
	}

	connectClient(client){
		const socket = new MockServerSocket(client);

		this.clients[socket.id] = socket;

		console.log(`[TestDriver] New WebSocket connection ${socket.id} to server ${this.id}`);
		this.emit('connection', socket);
	}
}

class MockUdpSocket extends events.EventEmitter {
	constructor(){
		super();

		this.id = 'u-' + crypto.randomBytes(5).toString('hex');

		// console.log(`[TestDriver] New UDP socket connection`);

		new Promise((resolve, reject) => {
			this.__resolve = resolve;
			this.__reject = reject;
		});

		this.port = null;
		this.address = null;

		socketsFromTestTargets.push(this);

		this.on('close', evt => {
			const index = socketsFromTestTargets.indexOf(this);
			if (index > -1){
				socketsFromTestTargets.splice(index, 1);
			}
		});
	}

	bind(port, address){
		this.port = port;
		this.address = address;
	}

	send(payload, offset, length, port, host, callback){
		// console.log(`[${this.id}] Client Wrote ${payload.length} bytes`);

		logEvent({
			id: 'RED',
			type: 'Runtime'
		}, '<udp-send>', {
			address: this.address,
			port: this.port,
			size: payload.length
		});

		const message = Buffer.from({ length: length });
		payload.copy(message, 0, offset, offset + length);
		mockUdpServer.emit('message', message, this);
	}

	unref(){
		return this;
	}

	close(){
		this.__resolve();
	}

	destroy(){
		this.__resolve();
	}
}

dgram.createSocket = function(protocol){
	return new MockUdpSocket();
}

/* done overwriting */

/* Overwriting fs to capture calls to fs (which are source/sinks) */
class BufferReadStream extends stream.Readable {
	constructor(content){
		super();
		this.content = content instanceof Buffer ? content : Buffer.from(content);
		this.cursor = 0;
	}

	_read(size){
		const readSize = Math.min(size, this.content.length - this.cursor);
		if (readSize === 0){
			this.push(null);
		}
		else {
			this.push(this.content.slice(this.cursor, (this.cursor = this.cursor + readSize)));
		}
	}
}

const virtualFS = {};

const overwriteFS = () => {

	const originalStatSync = fs.statSync;
	fs.statSync = function(targetPath){
		// this is a hack to allow "require" to work
		// inside the child node red component
		// (because require uses fs.readFileSync under the hood)
		if (/node_modules/.test(targetPath) || /node\-red/.test(targetPath)){
			return originalStatSync(targetPath);
		}

		targetPath = path.resolve(String(targetPath));
		if (virtualFS[targetPath] && virtualFS[targetPath].exists){
			virtualFS[targetPath].operations.push({
				timestamp: performance.now(),
				operation: 'statSync'
			});

			logEvent({
				id: 'RED',
				type: 'Runtime'
			}, '<fs-statSync>', {
				path: targetPath
			});

			return {
				isDirectory: () => virtualFS[targetPath].type === 'directory',
				isFile: () => virtualFS[targetPath].type === 'file',
				name: path.basename(targetPath),
				type: virtualFS[targetPath].type
			}
		}
		else {
			const error = new Error(`ENOENT: no such file or directory, scandir '${targetPath}'`);
			error.code = 'ENOENT';
			throw error;
		}
	}

	const originalStat = fs.stat;
	fs.stat = function(targetPath, callback){
		let err, result;
		try {
			result = fs.statSync(targetPath);
		}
		catch (error){
			err = error;
		}

		callback(err, result);
	}

	const originalMkdirSync = fs.mkdirSync;
	fs.mkdirSync = function(targetPath, mode){
		targetPath = path.resolve(String(targetPath));
		if (virtualFS[targetPath] && virtualFS[targetPath].exists){
			const error = new Error(`EEXIST: file already exists, mkdir '${targetPath}'`);
			error.code = 'EEXIST';
			throw error;
		}
		else {
			if (!virtualFS[targetPath]){
				virtualFS[targetPath] = {
					type: 'directory',
					exists: false,
					content: [],
					operations: []
				};
			}

			virtualFS[targetPath].exists = true;
			virtualFS[targetPath].operations.push({
				timestamp: performance.now(),
				operation: 'mkdirSync'
			});

			logEvent({
				id: 'RED',
				type: 'Runtime'
			}, '<fs-mkdirSync>', {
				path: targetPath
			});
		}
	}

	const originalReadFileSync = fs.readFileSync;
	fs.readFileSync = function(targetPath, encoding, options){
		// this is a hack to allow "require" to work
		// inside the child node red component
		// (because require uses fs.readFileSync under the hood)
		if (/node_modules/.test(targetPath) || /node\-red/.test(targetPath)){
			return originalReadFileSync(targetPath, encoding, options);
		}

		if (typeof encoding === 'object'){
			options = encoding;
			encoding = options.encoding || null;
		}

		targetPath = path.resolve(String(targetPath));
		if (!virtualFS[targetPath]){
			virtualFS[targetPath] = {
				type: 'file',
				exists: false,
				content: Buffer.from([]),
				operations: []
			};
		}

		virtualFS[targetPath].operations.push({
			timestamp: performance.now(),
			operation: 'readFileSync'
		});

		logEvent({
			id: 'RED',
			type: 'Runtime'
		}, '<fs-readFileSync>', {
			path: targetPath
		});

		if (virtualFS[targetPath].exists){
			if (encoding){
				return virtualFS[targetPath].content.toString(encoding);
			}
			else {
				return virtualFS[targetPath].content;
			}
		}
		else {
			const error = new Error(`ENOENT: no such file or directory, scandir '${targetPath}'`);
			error.code = 'ENOENT';
			throw error;
		}
	}

	const originalWriteFileSync = fs.writeFileSync;
	fs.writeFileSync = function(targetPath, content){
		targetPath = path.resolve(String(targetPath));
		if (!virtualFS[targetPath]){
			virtualFS[targetPath] = {
				type: 'file',
				exists: false,
				content: Buffer.from([]),
				operations: []
			};
		}
		virtualFS[targetPath].exists = true;
		virtualFS[targetPath].operations.push({
			timestamp: performance.now(),
			operation: 'write',
			data: content
		});

		const dirname = path.dirname(targetPath);
		if (virtualFS[dirname] && !virtualFS[dirname].content.includes(path.basename(targetPath))){
			virtualFS[dirname].content.push(path.basename(targetPath));
		}

		const writeContent = content instanceof Buffer ? content : Buffer.from(String(content));
		virtualFS[targetPath].content = writeContent;

		logEvent({
			id: 'RED',
			type: 'Runtime'
		}, '<fs-writeFileSync>', {
			path: targetPath,
			contentLength: writeContent.length
		});
	}

	const originalWriteFile = fs.writeFile;
	fs.writeFile = function(targetPath, content, callback){
		targetPath = path.resolve(String(targetPath));
		if (!virtualFS[targetPath]){
			virtualFS[targetPath] = {
				type: 'file',
				exists: false,
				content: Buffer.from([]),
				operations: []
			};
		}
		virtualFS[targetPath].exists = true;
		virtualFS[targetPath].operations.push({
			timestamp: performance.now(),
			operation: 'write',
			data: content
		});

		const dirname = path.dirname(targetPath);
		if (virtualFS[dirname] && !virtualFS[dirname].content.includes(path.basename(targetPath))){
			virtualFS[dirname].content.push(path.basename(targetPath));
		}

		const writeContent = content instanceof Buffer ? content : Buffer.from(String(content));
		virtualFS[targetPath].content = writeContent;

		logEvent({
			id: 'RED',
			type: 'Runtime'
		}, '<fs-writeFile>', {
			path: targetPath,
			contentLength: writeContent.length
		});
		
		setTimeout(() => {
			if (callback instanceof Function) callback(null);
		}, 1);
	}

	const originalAppendFile = fs.appendFile;
	fs.appendFile = function(targetPath, content, callback){
		targetPath = path.resolve(String(targetPath));
		if (!virtualFS[targetPath]){
			virtualFS[targetPath] = {
				type: 'file',
				exists: false,
				content: Buffer.from([]),
				operations: []
			};
		}
		virtualFS[targetPath].exists = true;
		virtualFS[targetPath].operations.push({
			timestamp: performance.now(),
			operation: 'append',
			data: content
		});

		const dirname = path.dirname(targetPath);
		if (virtualFS[dirname] && !virtualFS[dirname].content.includes(path.basename(targetPath))){
			virtualFS[dirname].content.push(path.basename(targetPath));
		}

		const appendContent = content instanceof Buffer ? content : Buffer.from(String(content));
		virtualFS[targetPath].content = Buffer.concat([virtualFS[targetPath].content, appendContent]);

		logEvent({
			id: 'RED',
			type: 'Runtime'
		}, '<fs-appendFile>', {
			path: targetPath,
			contentLength: appendContent.length
		});
		
		setTimeout(() => {
			if (callback instanceof Function) callback(null);
		}, 1);
	}

	const originalReaddir = fs.readdir;
	fs.readdir = function(targetPath, callback){
		targetPath = path.resolve(String(targetPath));
		if (!virtualFS[targetPath]){
			virtualFS[targetPath] = {
				type: 'directory',
				exists: false,
				content: [],
				operations: []
			};
		}

		virtualFS[targetPath].operations.push({
			timestamp: performance.now(),
			operation: 'readdir'
		});

		logEvent({
			id: 'RED',
			type: 'Runtime'
		}, '<fs-readdir>', {
			path: targetPath
		});

		setTimeout(() => {
			if (callback instanceof Function){
				const error = virtualFS[targetPath].exists ? null : new Error(`ENOENT: no such file or directory, scandir '${targetPath}'`);
				if (error){
					error.code = 'ENOENT';
				}
				callback(error, virtualFS[targetPath].content);
			}
		}, 1);
	};

	const originalUnlinkSync = fs.unlinkSync;
	fs.unlinkSync = function(targetPath){
		targetPath = path.resolve(String(targetPath));
		if (virtualFS[targetPath] && virtualFS[targetPath].exists){
			virtualFS[targetPath].exists = false;
			virtualFS[targetPath].operations.push({
				timestamp: performance.now(),
				operation: 'unlinkSync'
			});

			logEvent({
				id: 'RED',
				type: 'Runtime'
			}, '<fs-unlinkSync>', {
				path: targetPath
			});
		}
		else {
			const error = new Error(`ENOENT: no such file or directory, scandir '${targetPath}'`);
			error.code = 'ENOENT';
			throw error;
		}
	}

	const originalCreateReadStream = fs.createReadStream;
	fs.createReadStream = function(targetPath){
		targetPath = path.resolve(String(targetPath));
		if (virtualFS[targetPath] && virtualFS[targetPath].exists){
			virtualFS[targetPath].operations.push({
				timestamp: performance.now(),
				operation: 'createReadStream'
			});

			logEvent({
				id: 'RED',
				type: 'Runtime'
			}, '<fs-createReadStream>', {
				path: targetPath
			});

			return new BufferReadStream(virtualFS[targetPath].content);
		}
		else {
			const error = new Error(`ENOENT: no such file or directory, scandir '${targetPath}'`);
			error.code = 'ENOENT';
			throw error;
		}
	}

	return function revertFS(){
		fs.statSync = originalStatSync;
		fs.stat = originalStat;
		fs.mkdirSync = originalMkdirSync;
		fs.writeFileSync = originalWriteFileSync;
		fs.writeFile = originalWriteFile;
		fs.appendFile = originalAppendFile;
		fs.readdir = originalReaddir;
		fs.unlinkSync = originalUnlinkSync;
		fs.createReadStream = originalCreateReadStream;
		fs.readFileSync = originalReadFileSync;
	}
}
/* done overwriting */

/* Overwriting child_process to capture forks and execs (which are source/sinks) */

const virtualExecutables = {};

class MockChildProcess extends events.EventEmitter {
	constructor(executable, args, options, callback){
		super();
		this.pid = Math.floor(Math.random() * 65536);
		this.executable = executable;
		this.args = args;
		this.options = options;

		// console.log(`[TestDriver] Executing Mock Child Process ${executable} ${args.join(' ')}`);

		let stdout, stderr;
		if (virtualExecutables[executable]){
			const result = virtualExecutables[executable](args);
			stdout = result.stdout;
			stderr = result.stderr;
			this.callback = callback;
		}
		else {
			const error = new Error(`'${this.executable}' is not recognized as an internal or external command,
operable program or batch file.`);
			if (callback){
				callback(error);
			}
		}

		this.stdout = stdout;
		this.stderr = stderr;
	}
}

const overwriteCP = () => {

	const originalExec = child_process.exec;
	child_process.exec = function(command, options, callback){
		if (options instanceof Function){
			callback = options;
			options = null;
		}

		const tokens = command.replace(/ +/g, ' ').split(' ');
		const child = new MockChildProcess(tokens[0], tokens.slice(1), options, callback);

		if (child.callback){
			// console.log(`[TestDriver] Invoking Mock Child Process ${child.executable} ${child.args.join(' ')} Callback Function`);
			setTimeout(() => {
				child.callback(null, child.stdout, child.stderr);
			}, 10);
		}

		return child;
	}

	const originalSpawn = child_process.spawn;
	child_process.spawn = function(command, args, options){
		const child = new MockChildProcess(command, args, options);

		return child;
	}

	return function revertCP(){
		child_process.exec = originalExec;
		child_process.spawn = originalSpawn;
	}
}
/* done overwriting */

/* use async hooks to monitor async operations in the target application */
let asyncCount = 0;
let countAtScenarioBegin = 0;
const asyncMap = new Map();
const asyncHook = async_hooks.createHook({
  init(asyncId, type, triggerAsyncId, resource) {
  	if (type === 'PROMISE'){
  		asyncCount ++;
  		if (ASYNC_DEBUG){
  			const stack = (new Error()).stack;
	  		asyncMap.set(asyncId, { type: type, triggerAsyncId: triggerAsyncId, resource: resource, stack: stack });
  		}
  	}
  },
  promiseResolve(asyncId) {
	asyncCount --;
	if (ASYNC_DEBUG){
		asyncMap.delete(asyncId);	
	}
  },
  // destroy(asyncId) {
  // 	asyncCount --;
  // 	asyncMap.delete(asyncId);
  // },
});
const waitForAllAsync = () => new Promise((resolve, reject) => {
	const interval = setInterval(() => {
		if (ASYNC_DEBUG){
			console.log(`${asyncCount} - ${countAtScenarioBegin} pending promises`);
			console.log(Array.from(asyncMap.values()).map(item => item.stack));	
		}
		if (asyncCount === countAtScenarioBegin) {
			clearInterval(interval);
			resolve();
		}
    }, 10);
});

const printAsyncOperations = () => {
	console.log(`${asyncCount} - ${countAtScenarioBegin} pending promises`);
	console.log(Array.from(asyncMap.values()).map(item => item.stack));	
}

// asyncHook.enable();
/* end of async hook */

let eventLog = [];

function logEvent(instance, eventName, ...eventData){
	const event = {
		timestamp: performance.now(),
		emitter: {
			id: instance.id,
			type: instance.type
		},
		event: {
			name: eventName,
			data: eventData
		}
	};
	eventLog.push(event);
	if (DEBUG){
		console.log(`\n[${event.emitter.type} ${event.emitter.id}]\t${eventName}\t${eventData ? JSON.stringify(eventData) : ''}`);
	}
	return event;
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const request = {
	get: urlString => new Promise((resolve, reject) => {
		let urlObject = url.parse(urlString);
		let req = originalHttpRequest(
			{
				method: 'GET',
				hostname: urlObject.hostname,
				port: urlObject.port,
				path: urlObject.path
			},
			(res) => {
				let data = '';
				res.setEncoding('utf8');
				res.on('data', (chunk) => {
					data += chunk;
				});
				res.on('end', () => {
					let body = (res.headers['content-type'] && res.headers['content-type'].indexOf('application/json') === 0) ? JSON.parse(data) : data;

					resolve({
						status: res.statusCode,
						headers: res.headers,
						body: body
					});
				});
			});
		req.on('error', (e) => {
		  // console.error(`problem with request: ${e.message}`);
		  reject(e);
		});

		// Write data to request body
		// req.write(postData);
		req.end();
	}),
	post: (urlString, postData) => new Promise((resolve, reject) => {
		let urlObject = url.parse(urlString);
		let req = originalHttpRequest(
			urlString,
			{
				method: 'POST',
				hostname: urlObject.hostname,
				port: urlObject.port,
				path: urlObject.path,
				headers: {
					'Content-Type': 'application/json',
					'Content-Length': Buffer.byteLength(postData)
				},
				rejectUnauthorized: false
			},
			(res) => {
				let data = Buffer.from([]);
				//res.setEncoding('utf8');
				res.on('data', (chunk) => {
					data = Buffer.concat([data, chunk]);
				});
				res.on('end', () => {
					let body = (res.headers['content-type'] && res.headers['content-type'].indexOf('application/json') === 0) ? JSON.parse(data) : data;

					resolve({
						status: res.statusCode,
						headers: res.headers,
						body: body
					});
				});
			});
		req.on('error', (e) => {
		  reject(e);
		});

		// Write data to request body
		req.write(postData);
		req.end();
	}),
	put: (urlString, postData) => new Promise((resolve, reject) => {
		let urlObject = url.parse(urlString);
		let body = postData instanceof Buffer ? postData : (typeof postData === 'string' ? Buffer.from(postData) : Buffer.from(JSON.stringify(postData)));
		let req = originalHttpRequest(
			urlString,
			{
				method: 'PUT',
				hostname: urlObject.hostname,
				port: urlObject.port,
				path: urlObject.path,
				headers: {
					'Content-Type': 'application/json',
					'Content-Length': Buffer.byteLength(body)
				},
				rejectUnauthorized: false
			},
			(res) => {
				let data = Buffer.from([]);
				//res.setEncoding('utf8');
				res.on('data', (chunk) => {
					data = Buffer.concat([data, chunk]);
				});
				res.on('end', () => {
					console.log('received data from server');
					let body = (res.headers['content-type'] && res.headers['content-type'].indexOf('application/json') === 0) ? JSON.parse(data) : data;

					resolve({
						status: res.statusCode,
						headers: res.headers,
						body: body
					});
				});
			});
		req.on('error', (e) => {
		  reject(e);
		});
		['close', 'connect', 'continue', 'finish', 'information', 'response', 'socket', 'timeout', 'upgrade'].forEach(name => {
			req.on(name, evt => {
				console.log(`Request emitted ${name} event`);
			});
		});

		// Write data to request body
		req.write(body);
		req.end();
	})
}

function getFileList (absSourcePath) {
	if (!fs.existsSync(absSourcePath)){
		throw new Error(`path "${absSourcePath}"" does not exist`);
	}

	let stat = fs.statSync(absSourcePath);

    if (stat.isFile()){
    	return [ absSourcePath ];
    }
    else if (stat.isDirectory()) {
        console.log(`${absSourcePath} is a directory... trying to read as an NPM package`);

        const packageJsonPath = path.join(absSourcePath, 'package.json');
        let packageJson = null;

        if (fs.existsSync(packageJsonPath)){
        	const packageStat = fs.statSync(packageJsonPath);

        	if (packageStat.isFile()){
	            packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
	        }
        }

        if (packageJson){
        	if (packageJson.main && /^\w+\.js/.test(packageJson.main)){
        		return [ path.join(absSourcePath, packageJson.main) ];
        	}
        	else if (packageJson['node-red'] && packageJson['node-red'].nodes){
        		return Object.values(packageJson['node-red'].nodes).map(relativePath => path.join(absSourcePath, relativePath));
        	}
        }
        
        return [ path.join(absSourcePath, 'index.js') ];
    }
}

/* Helper functions copied from node-red
   to more accurately mock the runtime */
function createError(code, message) {
    var e = new Error(message);
    e.code = code;
    return e;
}

function normalisePropertyExpression(str, msg, toString) {
    // This must be kept in sync with validatePropertyExpression
    // in editor/js/ui/utils.js

    var length = str.length;
    if (length === 0) {
        throw createError("INVALID_EXPR","Invalid property expression: zero-length");
    }
    var parts = [];
    var start = 0;
    var inString = false;
    var inBox = false;
    var boxExpression = false;
    var quoteChar;
    var v;
    for (var i=0;i<length;i++) {
        var c = str[i];
        if (!inString) {
            if (c === "'" || c === '"') {
                if (i != start) {
                    throw createError("INVALID_EXPR","Invalid property expression: unexpected "+c+" at position "+i);
                }
                inString = true;
                quoteChar = c;
                start = i+1;
            } else if (c === '.') {
                if (i===0) {
                    throw createError("INVALID_EXPR","Invalid property expression: unexpected . at position 0");
                }
                if (start != i) {
                    v = str.substring(start,i);
                    if (/^\d+$/.test(v)) {
                        parts.push(parseInt(v));
                    } else {
                        parts.push(v);
                    }
                }
                if (i===length-1) {
                    throw createError("INVALID_EXPR","Invalid property expression: unterminated expression");
                }
                // Next char is first char of an identifier: a-z 0-9 $ _
                if (!/[a-z0-9\$\_]/i.test(str[i+1])) {
                    throw createError("INVALID_EXPR","Invalid property expression: unexpected "+str[i+1]+" at position "+(i+1));
                }
                start = i+1;
            } else if (c === '[') {
                if (i === 0) {
                    throw createError("INVALID_EXPR","Invalid property expression: unexpected "+c+" at position "+i);
                }
                if (start != i) {
                    parts.push(str.substring(start,i));
                }
                if (i===length-1) {
                    throw createError("INVALID_EXPR","Invalid property expression: unterminated expression");
                }
                // Start of a new expression. If it starts with msg it is a nested expression
                // Need to scan ahead to find the closing bracket
                if (/^msg[.\[]/.test(str.substring(i+1))) {
                    var depth = 1;
                    var inLocalString = false;
                    var localStringQuote;
                    for (var j=i+1;j<length;j++) {
                        if (/["']/.test(str[j])) {
                            if (inLocalString) {
                                if (str[j] === localStringQuote) {
                                    inLocalString = false
                                }
                            } else {
                                inLocalString = true;
                                localStringQuote = str[j]
                            }
                        }
                        if (str[j] === '[') {
                            depth++;
                        } else if (str[j] === ']') {
                            depth--;
                        }
                        if (depth === 0) {
                            try {
                                if (msg) {
                                    var crossRefProp = getMessageProperty(msg, str.substring(i+1,j));
                                    if (crossRefProp === undefined) {
                                        throw createError("INVALID_EXPR","Invalid expression: undefined reference at position "+(i+1)+" : "+str.substring(i+1,j))
                                    }
                                    parts.push(crossRefProp)
                                } else {
                                    parts.push(normalisePropertyExpression(str.substring(i+1,j), msg));
                                }
                                inBox = false;
                                i = j;
                                start = j+1;
                                break;
                            } catch(err) {
                                throw createError("INVALID_EXPR","Invalid expression started at position "+(i+1))
                            }
                        }
                    }
                    if (depth > 0) {
                        throw createError("INVALID_EXPR","Invalid property expression: unmatched '[' at position "+i);
                    }
                    continue;
                } else if (!/["'\d]/.test(str[i+1])) {
                    // Next char is either a quote or a number
                    throw createError("INVALID_EXPR","Invalid property expression: unexpected "+str[i+1]+" at position "+(i+1));
                }
                start = i+1;
                inBox = true;
            } else if (c === ']') {
                if (!inBox) {
                    throw createError("INVALID_EXPR","Invalid property expression: unexpected "+c+" at position "+i);
                }
                if (start != i) {
                    v = str.substring(start,i);
                    if (/^\d+$/.test(v)) {
                        parts.push(parseInt(v));
                    } else {
                        throw createError("INVALID_EXPR","Invalid property expression: unexpected array expression at position "+start);
                    }
                }
                start = i+1;
                inBox = false;
            } else if (c === ' ') {
                throw createError("INVALID_EXPR","Invalid property expression: unexpected ' ' at position "+i);
            }
        } else {
            if (c === quoteChar) {
                if (i-start === 0) {
                    throw createError("INVALID_EXPR","Invalid property expression: zero-length string at position "+start);
                }
                parts.push(str.substring(start,i));
                // If inBox, next char must be a ]. Otherwise it may be [ or .
                if (inBox && !/\]/.test(str[i+1])) {
                    throw createError("INVALID_EXPR","Invalid property expression: unexpected array expression at position "+start);
                } else if (!inBox && i+1!==length && !/[\[\.]/.test(str[i+1])) {
                    throw createError("INVALID_EXPR","Invalid property expression: unexpected "+str[i+1]+" expression at position "+(i+1));
                }
                start = i+1;
                inString = false;
            }
        }

    }
    if (inBox || inString) {
        throw new createError("INVALID_EXPR","Invalid property expression: unterminated expression");
    }
    if (start < length) {
        parts.push(str.substring(start));
    }

    if (toString) {
        var result = parts.shift();
        while(parts.length > 0) {
            var p = parts.shift();
            if (typeof p === 'string') {
                if (/"/.test(p)) {
                    p = "'"+p+"'";
                } else {
                    p = '"'+p+'"';
                }
            }
            result = result+"["+p+"]";
        }
        return result;
    }

    return parts;
}

function getObjectProperty(msg,expr) {
    var result = null;
    var msgPropParts = normalisePropertyExpression(expr,msg);
    msgPropParts.reduce(function(obj, key) {
        result = (typeof obj[key] !== "undefined" ? obj[key] : undefined);
        return result;
    }, msg);
    return result;
}

function getMessageProperty(msg,expr) {
    if (expr.indexOf('msg.')===0) {
        expr = expr.substring(4);
    }
    return getObjectProperty(msg,expr);
}

function parseContextStore(key) {
    var parts = {};
    var m = /^#:\((\S+?)\)::(.*)$/.exec(key);
    if (m) {
        parts.store = m[1];
        parts.key = m[2];
    } else {
        parts.key = key;
    }
    return parts;
}

function evaluateEnvProperty(value, node) {
    var flow = (node && hasOwnProperty.call(node, "_flow")) ? node._flow : null;
    var result;
    if (/^\${[^}]+}$/.test(value)) {
        // ${ENV_VAR}
        var name = value.substring(2,value.length-1);
        result = getSetting(node, name, flow);
    } else if (!/\${\S+}/.test(value)) {
        // ENV_VAR
        result = getSetting(node, value, flow);
    } else {
        // FOO${ENV_VAR}BAR
        return value.replace(/\${([^}]+)}/g, function(match, name) {
            var val = getSetting(node, name, flow);
            return (val === undefined)?"":val;
        });
    }
    return (result === undefined)?"":result;

}

function evaluateNodeProperty(value, type, node, msg, callback){
	let result = value;
    if (type === 'str') {
        result = "" + value;
    } else if (type === 'num') {
        result = Number(value);
    } else if (type === 'json') {
        result = JSON.parse(value);
    } else if (type === 're') {
        result = new RegExp(value);
    } else if (type === 'date') {
        if (!value) {
            result = Date.now();
        } else if (value === 'object') {
            result = new Date()
        } else if (value === 'iso') {
            result = (new Date()).toISOString()
        } else {
            result = moment().format(value)
        }
    } else if (type === 'bin') {
        var data = JSON.parse(value);
        if (Array.isArray(data) || (typeof(data) === "string")) {
            result = Buffer.from(data);
        }
        else {
            throw createError("INVALID_BUFFER_DATA", "Not string or array");
        }
    } else if (type === 'msg' && msg) {
        try {
            result = getMessageProperty(msg, value);
        } catch(err) {
            if (callback) {
                callback(err);
            } else {
                throw err;
            }
            return;
        }
    } else if ((type === 'flow' || type === 'global') && node) {
        var contextKey = parseContextStore(value);
        if (/\[msg/.test(contextKey.key)) {
            // The key has a nest msg. reference to evaluate first
            contextKey.key = normalisePropertyExpression(contextKey.key, msg, true)
        }
        result = node.context()[type].get(contextKey.key,contextKey.store,callback);
        if (callback) {
            return;
        }
    } else if (type === 'bool') {
        result = /^true$/i.test(value);
    } else if (type === 'env') {
        result = evaluateEnvProperty(value, node);
    }
    if (callback) {
        callback(null,result);
    } else {
        return result;
    }
}

function setMessageProperty(message, key, value){
	message[key] = value;
}
/* End of helper functions copied from node-red */

// custom helper functions
function extractLineNumber(stack){
	const lines = stack.split('\n').map(line => line.trim());

	for (let line of lines){
		const match = line.match(/^.+[\\\/]([\w-\.]+\.js):(\d+):\d+\)?$/);
		if (match && match.length >= 2 && match[1] !== 'PrivacyTracker.js'){
			return match[2];
		}
	}

	return 'unknown';
}

// This is equivalent to PrivacyTracker._getLabel.
// We need this because the Mock Runtime is not
// guaranteed to receive serialized objects/labels
function tryExtractLabel(obj, circularTracker){
	if (!obj) return;
	if (!circularTracker){
        circularTracker = new Map();
    }

    if (circularTracker.has(obj)){
        return circularTracker.get(obj);
    }

    circularTracker.set(obj, null);

    let obj_label;

    if (obj[LABEL_PROPERTY]){
    	obj_label = obj[LABEL_PROPERTY];
    }
    else {
    	const combined = new Set();
    	Object.values(obj).forEach(child => {
    		const childLabel = tryExtractLabel(child, circularTracker);
    		if (childLabel){
    			if (childLabel instanceof Set){
    				childLabel.forEach(item => combined.add(item));
    			}
    			else if (typeof childLabel === 'string'){
    				combined.add(childLabel)
    			}
    		}
    	});

    	if (combined.size > 0){
    		obj_label = combined;
    	}
    }

    if (obj_label instanceof Function){
    	obj_label = obj_label(null, null, circularTracker);

    	if (obj_label && Object.getPrototypeOf(obj_label).constructor.name === 'PrimitiveObject'){
    		obj_label = obj_label.value;
    	}
    }

    return obj_label;
}

const proxyPassProperties = ['toJSON'];
const proxyCache = new Map();
function createMockObject(target){

    const proxyHandler = {
        get (obj, prop, receiver){
        	let propValue = Reflect.get(obj, prop, receiver);

        	if (proxyPassProperties.includes(prop)){
        		return propValue;
        	}

            if (propValue){
            	if (typeof propValue !== 'object' && typeof propValue !== 'function'){
            		return propValue;
            	}

                let proxy = proxyCache.get(propValue);
                if (!proxy){
                	proxy = createMockObject(propValue);
                	proxyCache.set(propValue, proxy);
                }

                return proxy;
            }
            else {
            	if (propValue !== undefined){
            		return propValue;
            	}

            	propValue = {};
            	let proxy = createMockObject(propValue);
            	proxyCache.set(propValue, proxy);
            	Reflect.set(obj, prop, propValue, receiver);

            	return proxy;
            }
        },
        set (obj, prop, val, receiver){
            return Reflect.set(obj, prop, val, receiver);
        }
    }

    return new Proxy(target, proxyHandler);
}

class MockContext {
	constructor(ownerInstance){
		this.owner = ownerInstance;
		this.data = {};
	}

	get(key){
		logEvent(this.owner, 'context.get', key);
		return this.data[key];
	}

	set(key, val){
		logEvent(this.owner, 'context.set', key, val);
		this.data[key] = val;
	}
}

class MockNodeInstance extends events.EventEmitter {
	constructor(type, initFunc, config){
		super();
		this.setMaxListeners(100);
		this.id = crypto.randomBytes(5).toString('hex');
		this.type = type;
		this.config = config;
		this._context = new MockContext(this);

		const start = initFunc.bind(this);
		this.start = () => {
			logEvent(this, '<start>');
			start(this.config);
		}

		// this.on('input', message => logEvent(this, 'input', JSON.parse(JSON.stringify(message))));
		this.on('input', message => logEvent(this, 'input', message));
	}

	toJSON(){
		return {
			id: this.id,
			type: this.type
		}
	}

	// override the super.on method to wrap the input handler
	on(eventName, handler){
		if (eventName === 'input'){
			const wrappedHandler = (msg, send, done) => {
				try {
					return handler.call(this, msg, send, done);
				}
				catch(err){
					this.error(err);
				}
			}

			return super.on.call(this, eventName, wrappedHandler);
		}
		else {
			return super.on.call(this, eventName, handler);
		}
	}

	status(message){
		logEvent(this, 'status', message);
	}

	context(){
		return this._context;
	}

	send(message){
		// console.log(`Node.send called by ${this.type} ${this.id}`);
		// console.dir(message, { depth: 10 });
		if (message){
			// logEvent(this, 'output', JSON.parse(JSON.stringify(message)));
			logEvent(this, 'output', message);
			this.emit('output', message);
		}
	}

	warn(err){
		if (err instanceof PrivacyTracker.SecurityViolation){
			logEvent(this, '<policy-violation>', {
        		message: err.message,
        		labels: {
        			source: err.source,
        			sink: err.sink
        		},
        		fromNode: {
        			id: this.id,
        			type: this.type,
        			config: this.config,
        			label: this[LABEL_PROPERTY],
        			stack: err.stack
        		}
        	});
		}
		else {
			// console.log(err);
			logEvent(this, 'warn', JSON.parse(JSON.stringify(err)));
		}
	}

	error(err){
		if (err instanceof PrivacyTracker.SecurityViolation){
			logEvent(this, '<policy-violation>', {
        		message: err.message,
        		labels: {
        			source: err.source,
        			sink: err.sink
        		},
        		fromNode: {
        			id: this.id,
        			type: this.type,
        			config: this.config,
        			label: this[LABEL_PROPERTY],
        			stack: err.stack
        		}
        	});
		}
		else {
			if (DEBUG) console.log(err);
			logEvent(this, 'error', JSON.parse(JSON.stringify(err)));	
		}
	}
}

class MockNodeRedRuntime {
	constructor(){
		this.id = 'RED';
		this.type = 'Runtime';

		this.files = [];
		this.childTrackers = {};

		this.nodes = {};
		this.instances = {};

		this.httpNode = express();
		this.httpAdmin = express();
		this.__httpAuth = {
			needsPermission: perm => (req, res, next) => next()
		}

		this.__edgeChecksDisabled = false;
	}

	_registerType(name, initFunc, initSettings){
		this.nodes[name] = {
			init: initFunc,
			settings: initSettings || {}
		}
		console.log(`[TestDriver]\tRegistered Node "${name}"`);
	}

	_createNode(instance, config){
		this.instances[instance.id] = instance;
	}

	_eachNode(callback){
		Object.values(this.instances).forEach(callback);
	}

	_getNode(instanceId){
		return this.instances[instanceId];
	}

	_getCredentials(instanceId){
		return this.instances[instanceId].credentials || {};
	}

	_addCredentials(instanceId, credentials){
		if (this.instances[instanceId]){
			Object.assign(this.instances[instanceId].credentials, credentials);	
		}
		else {
			// Issue a warning that the instance does not exist
		}
	}

	getInstancesByType(type){
		return Object.values(this.instances).filter(item => item.type === type);
	}

	createInstance(type, config, label){
		const mockConfig = {};
		const instance = new MockNodeInstance(type, this.nodes[type].init, config || mockConfig);
		if (label){
			instance[LABEL_PROPERTY] = label;
		}

		// apply initSettings
		Object.assign(instance, this.nodes[type].settings);

		instance.start();

		return instance;
	}

	createMockSink(label){
		const instance = new MockNodeInstance('<mock-sink>', function(){
			console.log(`[TestDriver] Mock Sink "${label}" started`);
		});
		if (label){
			instance[LABEL_PROPERTY] = label;
			instance.id = 'sink-' + label;
		}

		instance.start();
		return instance;
	}

	createCustomInstance(type, initFunc, config, label){
		const instance = new MockNodeInstance(type, initFunc);
		if (label){
			instance[LABEL_PROPERTY] = label;
		}

		this.instances[instance.id] = instance;

		instance.start();
		return instance;
	}

	applyNodeSettings(type, settings){
		Object.assign(this.nodes[type].settings, settings);
	}

	sendToNode(receiver, message){
		receiver.emit('input', message, reply => receiver.send(reply), err => {
			logEvent(receiver, 'done', err);
		});
	}

	connectNodes(fromNode, toNode){
		if (this.__edgeChecksDisabled){
			fromNode.on('output', message => this.sendToNode(toNode, message));
			return;
		}

		fromNode.on('output', message => {
			const messageLabel = tryExtractLabel(message);

			if (messageLabel && toNode[LABEL_PROPERTY]){
				const obj_label = this.tracker._extractHighestLabel(messageLabel);
		        const sink_label = this.tracker._extractLowestLabel(toNode[LABEL_PROPERTY]);

				const distance = this.tracker._compareLabels('write', obj_label, sink_label);

		        if (distance !== null && distance >= 0){
		            // toNode.emit('input', message);
		            this.sendToNode(toNode, message);
		        }
		        else {
		        	logEvent(this, '<policy-violation>', {
		        		message: message,
		        		labels: {
		        			source: messageLabel,
		        			sink: toNode[LABEL_PROPERTY]
		        		},
		        		fromNode: {
		        			id: fromNode.id,
		        			type: fromNode.type,
		        			config: fromNode.config,
		        			label: fromNode[LABEL_PROPERTY]
		        		},
		        		toNode: {
		        			id: toNode.id,
		        			type: toNode.type,
		        			config: toNode.config,
		        			label: toNode[LABEL_PROPERTY]
		        		}
		        	});
		            // throw new Error(`Writing an Object with label "${message[LABEL_PROPERTY]}" to a Sink with label "${toNode[LABEL_PROPERTY]}" is forbidden`);
		        }
			}
			else {
				// toNode.emit('input', message);
				this.sendToNode(toNode, message);
			}
		});
	}

	loadPackage(packageData){
		// Mock API to inject into the node red init function
		const api = {
			nodes: {
				registerType: (name, initFunc, initSettings) => this._registerType(name, initFunc, initSettings),
				createNode: (thisRef, config) => this._createNode(thisRef, config),
				eachNode: (callback) => this._eachNode(callback),
				getNode: (instanceId) => this._getNode(instanceId),
				getCredentials: (instanceId) => this._getCredentials(instanceId),
				addCredentials: (instanceId, credentials) => this._addCredentials(instanceId, credentials)
			},
			log: {
				error: err => DEBUG && console.log(`[Node:Error] `, err),
				info: data => DEBUG && console.log(`[Node:Info]  `, data),
				debug: data => DEBUG && console.log(`[Node:Debug] `, data)
				// error: err => (`[Node:Error] `, err),
				// info: data => (`[Node:Info]  `, data),
				// debug: data => (`[Node:Debug] `, data)
			},
			util: {
				evaluateNodeProperty: evaluateNodeProperty,
				setMessageProperty: setMessageProperty,
				cloneMessage: msg => JSON.parse(JSON.stringify(msg))
			},
			settings: {
				verbose: false
			},
			httpNode: this.httpNode,
			httpAdmin: this.httpAdmin,
			auth: this.__httpAuth
		}

		const packageFiles = packageData instanceof Array ? packageData : getFileList(packageData);

		this.files = packageFiles;
		this.childTrackers = {};

		packageFiles.forEach(filePath => {
			// Overwrite globals to intercept POSIX source/sinks
			// const revertFS = overwriteFS();
			const revertCP = overwriteCP();

			const init = require(path.resolve(filePath));

			// revertFS();
			revertCP();

			console.log(`[TestDriver]\tLoaded ${filePath}`);

			// const node = { init: init };

			// node.init(api);

			init(api);

			const childTracker = PrivacyTracker.getByFilePath(filePath);
			if (childTracker){
				this.childTrackers[filePath] = childTracker;
			}
		});

		// nodes have been registerd after init
		// Object.keys(this.nodes).forEach(name => {
		// 	console.log(`[TestDriver]\tRegistered "${name}"`);
		// });
	}

	configureTracker(policy){
		this.tracker = new PrivacyTracker();
		this.tracker.configure(policy);
	}

	disableEdgeChecks(){
		this.__edgeChecksDisabled = true;
	}

	enableEdgeChecks(){
		this.__edgeChecksDisabled = false;
	}

	createMockObject(target){
		return createMockObject(target);
	}

	setMockRemoteServer(mockServer){
		mockRemoteServer = mockServer;
	}

	createMockWebSocketServer(){
		const wss = new MockSocketServer();
		mockWebSocketServer = wss;
		return wss;
	}

	createMockUdpSocket(){
		mockUdpServer = new MockUdpSocket();
		return mockUdpServer;
	}

	setMockFile(filePath, content){
		const rootDir = path.resolve('/');
		if (!virtualFS[rootDir]){
			virtualFS[rootDir] = {
				type: 'directory',
				exists: true,
				content: [],
				operations: []
			}
		}

		filePath = path.resolve(String(filePath));

		virtualFS[filePath] = {
			type: 'file',
			exists: true,
			content: Buffer.from(content),
			operations: []
		}
	}

	setMockDirectory(dirPath, files){
		const rootDir = path.resolve('/');
		if (!virtualFS[rootDir]){
			virtualFS[rootDir] = {
				type: 'directory',
				exists: true,
				content: [],
				operations: []
			}
		}

		dirPath = path.resolve(String(dirPath));

		virtualFS[dirPath] = {
			type: 'directory',
			exists: true,
			content: files,
			operations: []
		}

		files.forEach(file => {
			const filePath = path.join(dirPath, file);
			virtualFS[filePath] = {
				type: 'file',
				exists: true,
				content: Buffer.from([]),
				operations: []
			}
		})
	}

	getMockFileSystem(){
		return virtualFS;
	}

	setMockExecutable(executable, handler){
		virtualExecutables[executable] = handler;
	}

	closeAllSockets(){
		socketsFromTestTargets.forEach(socket => socket.destroy());
	}

	delay(ms){
		return delay(ms);
	}

	printAsyncOperations(){
		return printAsyncOperations();
	}

	reset(){
		this.files = [];
		this.childTrackers = {};

		this.nodes = {};
		this.instances = {};

		this.__edgeChecksDisabled = false;

		serversFromTestTargets.forEach((server) => server.close());
		eventLog = [];
	}

	async ajaxGetRequest(url, instance){
		// we need the instance explicitly as we cannot track the instance via ajax
		logEvent(instance, 'ajax-get');
		await request.get(url);
	}

	async ajaxPutRequest(url, data, instance){
		// we need the instance explicitly as we cannot track the instance via ajax
		logEvent(instance, 'ajax-put', data);
		await request.put(url, data);
	}

	async runTestScenario(scenario, workload){
		// Overwrite globals to intercept POSIX source/sinks
		const revertFS = overwriteFS();
		const revertCP = overwriteCP();

		// First augment the workload by adding metadata needed for analysis
		workload.inputs.forEach(message => message.__expId = crypto.randomBytes(5).toString('hex'));

		console.log(`[TestDriver]\tStarting Test Scenario\n`);
		logEvent(this, '<scenario-begin>');
		countAtScenarioBegin = parseInt(process.env.TEST_DRIVER_INITIAL_ASYNC_LEVEL) || 3;	// the root async in run-experiment.js, this function, and the waitForAllAsync below
		asyncHook.enable();
		await scenario(this, workload);

		// socketsFromTestTargets.forEach(socket => socket.destroy());

		await waitForAllAsync();

		// wait 1 second to receive any pending output;
		await delay(1000);
		
		logEvent(this, '<scenario-end>');

		// return analysis
		const results = {
			log: eventLog
		};

		const summary = Object.keys(this.instances).reduce((acc, key) => {
			const instance = this.instances[key];
			acc[key] = {
				type: instance.type,
				id: instance.id,
				config: instance.config,
				inputCount: 0,
				httpInputCount: 0,
				outputCount: 0,
				processedCount: 0,
				totalProcessingTime: 0,
				avgProcessingTime: 0
			};

			return acc;
		}, {});

		summary.RED = {
			checkCount: this.tracker.checkCount,
			policyViolations: {
				total: 0,
				locations: {}
			}
		};

		summary.fs = {
			fileReadCount: 0,
			fileWriteCount: 0,
			directoryReadCount: 0,
			directoryWriteCount: 0,
			details: {}
		}

		summary.net = {
			httpRequestCount: 0,
			udpSendCount: 0,
			websocketSendCount: 0,
			websocketReceiveCount: 0,
			details: {}
		}

		const messageMap = {};

		eventLog.forEach(log => {
			const emitterData = summary[log.emitter.id];
			if (emitterData){
				if (log.event.name === 'input'){
					emitterData.inputCount ++;

					if (log.event.data[0] && log.event.data[0].__expId){
						messageMap[log.event.data[0].__expId] = log.timestamp;
					}
				}
				else if (log.event.name.match(/^ajax-(\w+)$/)){
					emitterData.httpInputCount ++;

					if (log.event.data[0] && log.event.data[0].__expId){
						messageMap[log.event.data.__expId] = log.timestamp;
					}
				}
				else if (log.event.name === 'output'){
					emitterData.outputCount ++;

					if (log.event.data[0] && log.event.data[0].__expId){
						const processingTime = log.timestamp - messageMap[log.event.data[0].__expId];
						emitterData.totalProcessingTime += processingTime;
						emitterData.processedCount ++;
						// emitterData.avgProcessingTime = (emitterData.avgProcessingTime * (emitterData.processedCount - 1) + processingTime) / emitterData.processedCount;

						delete messageMap[log.event.data[0].__expId];
					}
					else if (log.event.data[0] instanceof Array){
						// sometimes the output is nested in an array (transformed by the application)
						// in that case, try to find the exp id in one of the elements
						const found = log.event.data[0].find(item => item && !!item.__expId);
						if (found){
							const processingTime = log.timestamp - messageMap[found.__expId];
							emitterData.totalProcessingTime += processingTime;
							emitterData.processedCount ++;
							// emitterData.avgProcessingTime = (emitterData.avgProcessingTime * (emitterData.processedCount - 1) + processingTime) / emitterData.processedCount;

							delete messageMap[found.__expId];
						}
					}
				}
				else if (log.event.name === '<policy-violation>'){
					let violatedAt;
					if (log.event.data[0].toNode){
						if (log.event.data[0].toNode.type === '<mock-sink>'){
							violatedAt = log.event.data[0].fromNode.id + '-Sink_' + log.event.data[0].toNode.label;
							log.event.data[0].toNode.id = 'sink-' + log.event.data[0].toNode.label;
						}
						else {
							violatedAt = log.event.data[0].fromNode.id + '-' + log.event.data[0].toNode.id;
						}
						
					}
					else {
						violatedAt = log.event.data[0].fromNode.id;
					}

					if (!summary.RED.policyViolations.locations[violatedAt]){
						summary.RED.policyViolations.locations[violatedAt] =  {
							fromNode: log.event.data[0].fromNode,
							toNode: log.event.data[0].toNode,
							count: 0
						}
					}
					summary.RED.policyViolations.locations[violatedAt].count ++;
					summary.RED.policyViolations.total ++;
				}
				else if (log.event.name === '<scenario-begin>'){
					results.began_at = log.timestamp;
				}
				else if (log.event.name === '<scenario-end>'){
					results.ended_at = log.timestamp;
					results.elapsed = log.timestamp - results.began_at;
				}
				else if (log.event.name.match(/^<fs-(\w+)>$/)){
					const match = log.event.name.match(/^<fs-(\w+)>$/);
					if (match[1] === 'createReadStream'){
						summary.fs.fileReadCount ++;
					}
					else if (match[1] === 'appendFile'){
						summary.fs.fileWriteCount ++;
					}
					else if (match[1] === 'readdir'){
						summary.fs.directoryReadCount ++;
					}
					else if (match[1] === 'mkdirSync'){
						summary.fs.directoryWriteCount ++;
					}

					let fileDetail = summary.fs.details[log.event.data.path];
					if (!fileDetail){
						fileDetail = summary.fs.details[log.event.data.path] = [];
					}

					fileDetail.push(match[1]);
				}
				else if (log.event.name === '<http-request>'){
					summary.net.httpRequestCount ++;

					// let reqDetail = summary.net.details[log.event.data.method];
					// if (!reqDetail){
					// 	reqDetail = summary.net.details[log.event.data.method] = [];
					// }

					// reqDetail.push(log.event.data.uri);
				}
				else if (log.event.name === '<udp-send>'){
					summary.net.udpSendCount ++;
				}
				else if (log.event.name === '<websocket-send>'){
					summary.net.websocketSendCount ++;
				}
				else if (log.event.name === '<websocket-receive>'){
					summary.net.websocketReceiveCount ++;
				}
			}
		});

		Object.keys(summary)
		.filter(id => id !== 'RED' && id !== 'fs' && id !== 'net')
		.forEach(key => {
			const nodeResult = summary[key];
			nodeResult.avgProcessingTime = nodeResult.totalProcessingTime / nodeResult.processedCount;
		});

		Object.values(this.childTrackers).forEach(item => {
			summary.RED.checkCount += item.checkCount;
		});

		results.summary = summary;

		// revert globals
		revertFS();
		revertCP();

		return results;
	}

	printResults(results){
		const nodes = Object.keys(results.summary).filter(id => id !== 'RED' && id !== 'fs' && id !== 'net');
		const output = `## Nodes Summary

Time Taken:        ${results.elapsed} ms
Total # of Nodes:  ${nodes.length}
Total # of Checks: ${results.summary.RED.checkCount}

${nodes.map(id => {
	const node = results.summary[id];
	return `  * Node [${node.type} ${node.id}]
    Config: ${JSON.stringify(node.config)}
    
    RED-input:  ${node.inputCount}
    HTTP-input: ${node.httpInputCount}
    RED-output: ${node.outputCount}
    Processed:  ${node.processedCount}
    Avg. processing time:  ${node.avgProcessingTime}
    Total processing time: ${node.totalProcessingTime}`
}).join('\n\n')}

-----
## POSIX Access

Total # File Reads:         ${results.summary.fs.fileReadCount}
Total # File Writes:        ${results.summary.fs.fileWriteCount}
Total # Directory Reads:    ${results.summary.fs.directoryReadCount}
Total # Directory Writes:   ${results.summary.fs.directoryWriteCount}

Total # HTTP Requests:      ${results.summary.net.httpRequestCount}
Total # UDP Sends:          ${results.summary.net.udpSendCount}
Total # WebSocket Sends:    ${results.summary.net.websocketSendCount}
Total # WebSocket Receives: ${results.summary.net.websocketReceiveCount}

-----
## Privacy Violations

Total # of violations: ${results.summary.RED.policyViolations.total}

Locations of violation:
${Object.keys(results.summary.RED.policyViolations.locations).map(key => {
	const location = results.summary.RED.policyViolations.locations[key];
	const description = `${location.fromNode.type} ${location.fromNode.id}` + (location.toNode ? ` ~ ${location.toNode.type} ${location.toNode.id}` : ` Line ${extractLineNumber(location.fromNode.stack)}`);
	
	return `  * ${description}:\t${results.summary.RED.policyViolations.locations[key].count}`
}).join('\n')}
`;
		console.log(output);
	}
}

module.exports = {
	MockNodeRedRuntime: MockNodeRedRuntime,
	getPackageFileList: getFileList
}