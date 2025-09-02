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
		query: 'Restaurants',
		region: labels.pickRandom()
	}
};

const policy = {
	labellers: {
		node: node => node.config.table,
		data: data => data.x,
		response: resp => resp.json.y
	},
	rules: [
		'A -> B',
		'B -> C'
	]
}

const mockServer = (req, res) => {
	const query = req.uri.query.split('&').reduce((acc, line) => {
		const [ key, val ] = line.split('=');
		acc[key] = val;
		return acc;
	}, {});

	if (req.uri.path === '/login'){
		res.status(200).json({
			token: crypto.randomBytes(10).toString('hex')
		});
	}
	else {
		res.status(200).json({
			list: [{
				name: 'Test Place',
				lat: 49.123,
				long: 121.142
			}],
			y: query.region
		});
	}
}

module.exports = {
	package: 'node-red-contrib-viseo/node-red-contrib-google-maps',
	generateInput: generateInput,
	policy: policy,
	setup: () => {
		// needed for VISEO components
		process.env.CONFIG_PATH = path.resolve(__dirname, 'exp-google-maps.config.js');
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
			key: 'AIza-test-google-key'
		};
		
		const config1 = {
			auth: authInstance.id,
			parameters: {
				'query': { value: 'query', typedInput: 'msg' },
				'region': { value: 'region', typedInput: 'msg' }
			}
		};
		const instance1 = runtime.createInstance('google-places', config1);

		helpers.createTestSinks(runtime, workload.labels || POSSIBLE_IDS, [ instance1 ]);

		await runtime.delay(100);

		// Object.values(runtime.instances).forEach(instance => {
		// 	let testMsg = generateInput();
		// 	instance.emit('input', testMsg);
		// });

		for (let message of workload.inputs){
			instance1.emit('input', message);

			if (workload.interval){
				await runtime.delay(workload.interval);
			}
		}
	}
}