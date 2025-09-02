// Note: set countAtScenarioBegin = 2 in TestDriver.js for this experiment
process.env.TEST_DRIVER_INITIAL_ASYNC_LEVEL = 2;
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
		input: 'experiments/exp-jimp-test-image.jpg'
	}
};

const policy = {
	labellers: {
		node: node => node.config.table,
		data: data => data.x
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
	package: 'node-red-contrib-viseo/node-red-contrib-jimp',
	generateInput: generateInput,
	policy: policy,
	setup: () => {
		// needed for VISEO components
		process.env.CONFIG_PATH = path.resolve(__dirname, 'exp-jimp.config.js');
		process.env.NODE_ENV = 'dev';
		process.env.FRAMEWORK_ROOT = path.resolve(__dirname, '../test-packages/node-red-contrib-viseo/node_modules/node-red-viseo-bot-manager');
	},
	scenario: async (runtime, workload) => {
		runtime.setMockRemoteServer(mockServer);
		
		runtime.applyNodeSettings('jimp', {
			credentials: {}
		});

		const config = {
			pathIn: 'input',
			pathInType: 'msg',
			pathOut: 'output',
			pathOutType: 'string',
			"crop-rect": {
				top: 10,
				left: 10,
				width: 120,
				height: 80
			}
		};
		const instance = runtime.createInstance('jimp', config);

		helpers.createTestSinks(runtime, workload.labels || POSSIBLE_IDS, [ instance ]);

		await runtime.delay(100);

		// for (let i = 0; i < 3; i ++){
		// 	let testMsg = generateInput();
		// 	instance.emit('input', testMsg);
		// }

		for (let message of workload.inputs){
			instance.emit('input', message);

			if (workload.interval){
				await runtime.delay(workload.interval);
			}
		}

		// let testMsg = runtime.createMockObject({
		// 	record: 'test-id'
		// });
		// let testMsg = generateInput();
		// node2.emit('input', testMsg);

		// console.log(testMsg);
	}
}