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
		y: labels.pickRandom(),
		text: 'Hello world'
	}
};

const policy = {
	labellers: {
		node: node => node.config.table,
		data: data => data.x
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
	package: 'node-red-contrib-viseo/node-red-contrib-nlp-js',
	generateInput: generateInput,
	policy: policy,
	setup: () => {
		// needed for VISEO components
		process.env.CONFIG_PATH = path.resolve(__dirname, 'exp-nlp-js.config.js');
		process.env.NODE_ENV = 'dev';
		process.env.FRAMEWORK_ROOT = path.resolve(__dirname, '../test-packages/node-red-contrib-viseo/node_modules/node-red-viseo-bot-manager');
	},
	scenario: async (runtime, workload) => {
		runtime.setMockRemoteServer(mockServer);

		runtime.applyNodeSettings('nlp-js-config', {
			credentials: {}
		});

		const config1 = {};
		const instance1 = runtime.createInstance('nlp-js-config', config1);

		const config2 = {
			model: config1.id,
			input: 'text',
			inputType: 'msg',
			language: [ 'en' ],
			action: 'sentiment'
		};
		const instance2 = runtime.createInstance('nlp-js', config2);

		helpers.createTestSinks(runtime, workload.labels || POSSIBLE_IDS, [ instance2 ]);
		
		await runtime.delay(100);

		// Object.values(runtime.instances).forEach(instance => {
		// 	let testMsg = generateInput();
		// 	instance.emit('input', testMsg);
		// });

		for (let message of workload.inputs){
			instance2.emit('input', message);

			if (workload.interval){
				await runtime.delay(workload.interval);
			}
		}
	}
}