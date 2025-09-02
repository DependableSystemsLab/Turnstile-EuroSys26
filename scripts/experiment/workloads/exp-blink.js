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
		x: labels.pickRandom(),
		token: crypto.randomBytes(10).toString('hex'),
		networkId: labels.pickRandom()
	}
};

const policy = {
	labellers: {
		node: node => node.config.label,
		data: data => data.x,
		blink: {
			invoke: (object, args) => {
				const match = args[0].uri.match(/^https:\/\/[\w\.-]+\/network\/(\w)+\/command$/);
				return match ? match[1] : 'A';
			}
		}
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
	package: 'node-red-contrib-viseo/node-red-contrib-blink',
	generateInput: generateInput,
	policy: policy,
	setup: () => {
		// needed for VISEO components
		process.env.CONFIG_PATH = path.resolve(__dirname, 'exp-blink.config.js');
		process.env.NODE_ENV = 'dev';
		process.env.FRAMEWORK_ROOT = '../../node-red-viseo-bot-manager';
	},
	scenario: async (runtime, workload) => {
		runtime.setMockRemoteServer(mockServer);

		runtime.applyNodeSettings('blink', {
			credentials: {
				login: 'test-user',
				password: 'test-password'
			}
		});

		const config = {
			action: 'command',
			token: 'token',
			tokenType: 'msg',
			networkId: 'networkId',
			networkIdType: 'msg'
		};
		const instance = runtime.createInstance('blink', config);

		helpers.createTestSinks(runtime, workload.labels || POSSIBLE_IDS, [ instance ]);

		await runtime.delay(100);

		for (let message of workload.inputs){
			instance.emit('input', message);

			if (workload.interval){
				await runtime.delay(workload.interval);
			}
		}

		// let testMsg = generateInput();
		// instance.emit('input', testMsg);
	}
}