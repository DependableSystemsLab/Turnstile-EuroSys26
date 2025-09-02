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
		order: {
			merchantOrderId: labels.pickRandom(),
			contents: {
				lineItems: [{
					name: 'A',
					reservation: {}
				}]
			}
		}
	}
};

const policy = {
	labellers: {
		node: node => node.config.table,
		data: data => data.x,
		service: {
			invoke: (obj, args) => {
				const match = args[0].url.match(/^https:\/\/[\w\.-\/]+\/orders\/(\w)+$/);
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
	package: 'node-red-contrib-viseo/node-red-contrib-google-actions',
	generateInput: generateInput,
	policy: policy,
	setup: () => {
		// needed for VISEO components
		process.env.CONFIG_PATH = path.resolve(__dirname, 'exp-google-actions.config.js');
		process.env.NODE_ENV = 'dev';
		process.env.FRAMEWORK_ROOT = path.resolve(__dirname, '../test-packages/node-red-contrib-viseo/node_modules/node-red-viseo-bot-manager');
	},
	scenario: async (runtime, workload) => {
		runtime.setMockRemoteServer(mockServer);

		// We need to inject the following mock instance
		// for google-* packages, as the auth node is not available
		const authInstance = runtime.createCustomInstance('google-auth', function(config){
			this.authenticate = callback => callback(this);
		});
		authInstance.credentials = {
			access_token: 'test-google-token'
		};
		
		const config1 = {
			auth: authInstance.id,
			action: 'token'
		};
		const instance1 = runtime.createInstance('google-actions', config1);

		const config2 = {
			auth: authInstance.id,
			order: 'order',
			orderItemNames: ['item-A', 'item-B', 'item-C'],
			orderStatus: 'available',
			statusLabel: 'Available'
		};
		const instance2 = runtime.createInstance('google-order-update', config2);

		helpers.createTestSinks(runtime, workload.labels || POSSIBLE_IDS, [ instance1, instance2 ]);

		await runtime.delay(100);

		// Object.values(runtime.instances).forEach(instance => {
		// 	let testMsg = generateInput();
		// 	instance.emit('input', testMsg);
		// });

		for (let message of workload.inputs){
			instance1.emit('input', message);
			instance2.emit('input', message);

			if (workload.interval){
				await runtime.delay(workload.interval);
			}
		}
	}
}