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
		payload: crypto.randomBytes(1000),
		language: labels.pickRandom()
	}
};

const policy = {
	labellers: {
		data: data => data.x,
		service: {
			invoke: (obj, args) => {
				return args[1].language;
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
	else if (req.uri.pathname.split('/').slice(-1)[0] === 'issueToken'){
		res.status(200).send('test-ms-speech-token');
	}
	else if (req.uri.pathname.split('/').slice(-1)[0] === 'list'){
		res.status(200).json([ 'test-voice' ]);
	}
	else if (req.uri.pathname.split('/').slice(-1)[0] === 'v1'){
		res.status(200).json({
			text: 'Test response from server'
		});
	}
}

module.exports = {
	package: 'node-red-contrib-viseo/node-red-contrib-ms-speech',
	generateInput: generateInput,
	policy: policy,
	setup: () => {
		// needed for VISEO components
		process.env.CONFIG_PATH = path.resolve(__dirname, 'exp-ms-speech.config.js');
		process.env.NODE_ENV = 'dev';
		process.env.FRAMEWORK_ROOT = path.resolve(__dirname, '../test-packages/node-red-contrib-viseo/node_modules/node-red-viseo-bot-manager');
	},
	scenario: async (runtime, workload) => {
		runtime.setMockRemoteServer(mockServer);
		
		// We need to inject the following mock instance
		// for ms-* packages, as the auth node is not available
		const authInstance = runtime.createCustomInstance('ms-auth', function(config){
			this.authenticate = callback => callback(this);
		});
		authInstance.credentials = {
			key: {
				key: 'test-key',
				region: 'westus'
			}
		};

		const config1 = {
			key: authInstance.id,
			input: 'payload',
			inputType: 'msg',
			language: 'language',
			languageType: 'msg'
		};
		const instance1 = runtime.createInstance('ms-speech-text', config1);

		helpers.createTestSinks(runtime, workload.labels || POSSIBLE_IDS, [ instance1 ]);

		await runtime.delay(100);

		// Object.values(runtime.instances).forEach(instance => {
		// 	let testMsg = generateInput();
		// 	instance.emit('input', testMsg);
		// });

		for (let message of workload.inputs){
			message.payload = Buffer.from(message.payload);
			instance1.emit('input', message);

			if (workload.interval){
				await runtime.delay(workload.interval);
			}
		}
	}
}