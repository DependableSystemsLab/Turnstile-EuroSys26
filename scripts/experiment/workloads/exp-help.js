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
		token: labels.pickRandom()
	}
};

const policy = {
	labellers: {
		node: node => node.config.table,
		data: data => data.x,
		service: {
			invoke: (obj, args) => {
				return args[1].content;
			}
		}
	},
	rules: [
		'A -> B',
		'B -> C'
	]
}

const mockServer = (req, res) => {
	if (req.uri.path === '/flows'){
		res.status(200).json({
			token: crypto.randomBytes(10).toString('hex')
		});
	}
	else if (req.uri.path.split('/').slice(-1)[0] === 'command'){
		res.status(200).json([ 'move', 'spin', 'shake' ]);
	}
}

module.exports = {
	package: 'node-red-contrib-viseo/node-red-contrib-help',
	generateInput: generateInput,
	policy: policy,
	setup: () => {
		// needed for VISEO components
		process.env.CONFIG_PATH = path.resolve(__dirname, 'exp-help.config.js');
		process.env.NODE_ENV = 'dev';
		process.env.FRAMEWORK_ROOT = path.resolve(__dirname, '../test-packages/node-red-contrib-viseo/node_modules/node-red-viseo-bot-manager');
	},
	scenario: async (runtime, workload) => {
		runtime.setMockRemoteServer(mockServer);

		runtime.setMockFile('test-file.json', JSON.stringify({ content: 'B' }));

		runtime.applyNodeSettings('nodes-config', {
			credentials: {
				url: 'http://example.org',
				username: 'username',
				usernameType: 'msg',
				password: 'password',
				passwordType: 'msg',
				token: 'token',
				tokenType: 'msg'
			}
		});
		const config1 = {};
		const instance1 = runtime.createInstance('nodes-config', config1);

		const config2 = {
			cred: instance1.id,
			process: 'restore',
			output: 'payload',
			outputType: 'msg',
			flows: 'test-file.json'
		};
		const instance2 = runtime.createInstance('nodes', config2);

		const config3 = {
		};
		const instance3 = runtime.createInstance('node-comment', config3);

		const config4 = {
		};
		const instance4 = runtime.createInstance('help-html', config4);

		helpers.createTestSinks(runtime, workload.labels || POSSIBLE_IDS, [ instance2, instance3, instance4 ])

		await runtime.delay(100);

		// Object.values(runtime.instances).forEach(instance => {
		// 	let testMsg = generateInput();
		// 	instance.emit('input', testMsg);
		// });

		for (let message of workload.inputs){
			instance2.emit('input', message);
			// instance3.emit('input', message);
			// instance4.emit('input', message);

			if (workload.interval){
				await runtime.delay(workload.interval);
			}
		}

		await runtime.delay(100);
	}
}