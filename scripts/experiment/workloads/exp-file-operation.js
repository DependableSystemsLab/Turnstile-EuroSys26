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
		path: labels.pickRandom()
	}
};

const policy = {
	labellers: {
		node: node => node.config.table,
		data: data => data.path
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
	package: 'node-red-contrib-viseo/node-red-contrib-file-operation',
	generateInput: generateInput,
	policy: policy,
	setup: () => {
		// needed for VISEO components
		process.env.CONFIG_PATH = path.resolve(__dirname, 'exp-file-operation.config.js');
		process.env.NODE_ENV = 'dev';
		process.env.FRAMEWORK_ROOT = path.resolve(__dirname, '../test-packages/node-red-contrib-viseo/node_modules/node-red-viseo-bot-manager');
	},
	scenario: async (runtime, workload) => {
		runtime.setMockFile('test-log.log', `1234567,241535,235325\n1236455,209535,230593`);
		runtime.setMockDirectory('.', [
			'test-log-2023-09-01.log',
			'test-log-2023-10-01.log',
			'test-log-2023-11-01.log',
			'test-log-2023-12-01.log',
			'test-log-2024-01-01.log',
			'test-log-2024-02-01.log',
			'test-log-2024-03-01.log',
			'test-log-2024-04-01.log',
			'test-log-2024-05-01.log',
			'test-log-2024-06-01.log'
		]);
		(workload.labels || POSSIBLE_IDS).forEach(name => runtime.setMockDirectory(name, [
			'test-log-2023-09-01.log',
			'test-log-2023-10-01.log',
			'test-log-2023-11-01.log',
			'test-log-2023-12-01.log',
			'test-log-2024-01-01.log',
			'test-log-2024-02-01.log',
			'test-log-2024-03-01.log',
			'test-log-2024-04-01.log',
			'test-log-2024-05-01.log',
			'test-log-2024-06-01.log'
		]))

		const config1 = {
			location: 'path',
			locationType: 'msg',
			operation: 'stats'
		};
		const instance1 = runtime.createInstance('file-operation', config1);

		const config2 = {
			location: 'path',
			locationType: 'msg',
			operation: 'list'
		};
		const instance2 = runtime.createInstance('file-operation', config2);

		helpers.createTestSinks(runtime, workload.labels || POSSIBLE_IDS, [ instance1, instance2 ]);

		await runtime.delay(100);

		for (let message of workload.inputs){
			instance1.emit('input', message);
			instance2.emit('input', message);

			if (workload.interval){
				await runtime.delay(workload.interval);
			}
		}
		
		await runtime.delay(100);
	}
}