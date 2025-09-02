// Note for this experiment:
// - In lgtv-connfig.js line 14-25, an LGTV instance is created
//   which by default attempts to auto-reconnect upon connection failure.
//   This needs to be disabled by passing the additional config option -- "reconnect: true".
//   Otherwise the experiment will not halt as the LGTV instance keeps
//   renewing connections and filling up the async queue.

const path = require('path');
const crypto = require('crypto');
const helpers = require('./helpers.js');

const POSSIBLE_IDS = [
	'A',
	'B',
	'C'
];

const generateInput = (labels = POSSIBLE_IDS) => {
	return {
		'lgtv-app': {
			payload: labels.pickRandom()
		},
		'lgtv-volume': {
			payload: labels.pickRandom()
		},
		'lgtv-mute': {
			payload: labels.pickRandom()
		},
		'lgtv-channel': {
			payload: labels.pickRandom()
		}
	}
};

const policy = {
	labellers: {
		data: data => data.payload
	},
	issuers: {
		airtable: obj => obj.name.split('-').slice(-1)[0]
	},
	rules: [
		'A -> B',
		'B -> C'
	]
}

const mockServer = (req, res) => {
	if (req.uri.path === '/login'){
		res.status(200).json({
			token: crypto.randomBytes(10).toString('hex')
		});
	}
	else if (req.uri.path.split('/').slice(-1)[0] === 'command'){
		res.status(200).json([ 'move', 'spin', 'shake' ]);
	}
}

module.exports = {
	package: 'node-red-contrib-lgtv',
	generateInput: generateInput,
	policy: policy,
	scenario: async (runtime, workload) => {
		workload.inputs.forEach(message => Object.values(message).forEach(item => { item.__expId = crypto.randomBytes(5).toString('hex'); }));
		
		runtime.setMockRemoteServer(mockServer);

		const wss = runtime.createMockWebSocketServer();
		wss.on('connection', socket => {
			socket.on('data', chunk => {
				const message = JSON.parse(chunk.toString('utf8'));
				// console.log(message);

				if (message.type === 'register'){
					socket.write(JSON.stringify({
						id: message.id,
						payload: {
							'client-key': message.payload['client-key']	
						}
					}));
				}
				else if (message.type === 'request'){
					const command = message.uri.split('/').slice(-1)[0];

					const payload = {
						command: command,
						acknowledged: true
					};

					if (command === 'getPointerInputSocket'){
						payload.socketPath = 'ws://special.socket.path/123';
					}
					else if (command === 'setVolume'){
						payload.subscribed = true;
						payload.volume = 42;
					}
					else if (command === 'setMute'){
						payload.subscribed = true;
						payload.muted = true;
					}
					else if (command === 'openChannel'){
						payload.subscribed = true;
						payload.channelId = 10;
					}

					socket.write(JSON.stringify({
						id: message.id,
						payload: payload
					}))
				}
			})
		});

		runtime.applyNodeSettings('lgtv-config', {
			credentials: {
				token: 'test-lgtv-token'
			}
		});

		const config1 = {
			host: '192.168.0.100'
		};
		const instance1 = runtime.createInstance('lgtv-config', config1);

		// const config2 = {};
		// const instance2 = runtime.createInstance('lgtv-control', config2);

		// const config3 = {};
		// const instance3 = runtime.createInstance('lgtv-button', config3);

		// const config4 = {};
		// const instance4 = runtime.createInstance('lgtv-mouse', config4);

		// const config5 = {};
		// const instance5 = runtime.createInstance('lgtv-toast', config5);

		// const config6 = {};
		// const instance6 = runtime.createInstance('lgtv-browser', config6);

		// const config7 = {};
		// const instance7 = runtime.createInstance('lgtv-youtube', config7);

		const config8 = {
			tv: instance1.id,
			passthru: true
		};
		const instance8 = runtime.createInstance('lgtv-app', config8);

		const config9 = {
			tv: instance1.id,
			passthru: true
		};
		const instance9 = runtime.createInstance('lgtv-volume', config9);

		const config10 = {
			tv: instance1.id,
			passthru: true
		};
		const instance10 = runtime.createInstance('lgtv-mute', config10);

		const config11 = {
			tv: instance1.id,
			passthru: true
		};
		const instance11 = runtime.createInstance('lgtv-channel', config11);

		// const config12 = {};
		// const instance12 = runtime.createInstance('lgtv-request', config12);

		helpers.createTestSinks(runtime, workload.labels || POSSIBLE_IDS, [ instance8, instance9, instance10, instance11 ]);

		await runtime.delay(200);

		let testMsg = generateInput();
		// instance8.emit('input', testMsg[instance8.type]);
		// instance9.emit('input', testMsg[instance9.type]);
		// instance10.emit('input', testMsg[instance10.type]);
		// instance11.emit('input', testMsg[instance11.type]);

		for (let message of workload.inputs){
			instance8.emit('input', message[instance8.type]);
			instance9.emit('input', message[instance9.type]);
			instance10.emit('input', message[instance10.type]);
			instance11.emit('input', message[instance11.type]);

			if (workload.interval){
				await runtime.delay(workload.interval);
			}
		}

		// console.log(testMsg);
		await runtime.delay(500);

		runtime.closeAllSockets();
	}
}