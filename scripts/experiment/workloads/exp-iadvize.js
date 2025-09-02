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
		endpoint: labels.pickRandom(),
		payload: {
			p: labels.pickRandom()
		}
	}
};

const policy = {
	labellers: {
		node: node => node.config.table,
		data: data => data.x,
		service: {
			invoke: (obj, args) => {
				return args[0].uri.split('/').slice(-1)[0];
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
	else {
		res.status(200).json({
			data: { token: crypto.randomBytes(10).toString('hex') }
		});
	}
}

module.exports = {
	package: 'node-red-contrib-viseo/node-red-contrib-iadvize',
	generateInput: generateInput,
	policy: policy,
	setup: () => {
		// needed for VISEO components
		process.env.CONFIG_PATH = path.resolve(__dirname, 'exp-iadvize.config.js');
		process.env.NODE_ENV = 'dev';
		process.env.FRAMEWORK_ROOT = path.resolve(__dirname, '../test-packages/node-red-contrib-viseo/node_modules/node-red-viseo-bot-manager');
	},
	scenario: async (runtime, workload) => {
		runtime.setMockRemoteServer(mockServer);

		runtime.applyNodeSettings('iadvize-config', {
			credentials: {
				rest: 'test-rest-token',
				graphql: 'test-graphql-token'
			}
		});

		const config1 = {
			rest_endpoint: 'https://iadvize-test.org/rest',
			graphql_endpoint: 'https://iadvize-test.org/graphql'
		};
		const node1 = runtime.createInstance('iadvize-config', config1);

		const config2 = {
			config: node1.id,
			action: 'GET',
			endpoint: 'endpoint',
			endpointType: 'msg',
			payload: 'payload',
			payloadType: 'msg'
		};
		const node2 = runtime.createInstance('iadvize-query', config2);

		const config3 = {};
		const node3 = runtime.createInstance('iadvize-handover', config3);

		const config4 = {};
		const node4 = runtime.createInstance('server-iadvize', config4);
		
		helpers.createTestSinks(runtime, workload.labels || POSSIBLE_IDS, [ node2, node3, node4 ]);

		await runtime.delay(100);

		// Object.values(runtime.instances).forEach(instance => {
		// 	let testMsg = generateInput();
		// 	instance.emit('input', testMsg);
		// });

		for (let message of workload.inputs){
			node2.emit('input', message);

			if (workload.interval){
				await runtime.delay(workload.interval);
			}
		}

		await runtime.delay(100);
	}
}