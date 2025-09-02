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
		'ms-spell-check': {
			endpoint: 'https://api.cognitive.microsoft.com/bing/v7.0/spellcheck/' + labels.pickRandom(),
			text: labels.pickRandom(),
			query: 'Test Query'
		},
		'ms-cs-search': {
			query: labels.pickRandom(),
			topic: labels.pickRandom()
		}
	}
};

const policy = {
	labellers: {
		dataSC: data => data.text,
		dataSearch: data => data.query,
		SC: {
			invoke: (obj, args) => {
				const match = args[0].url.match(/^.+\/spellcheck\/(\w)+\?.+$/);
				return match ? match[1] : 'A';
			}
		},
		search: {
			invoke: (obj, args) => {
				const match = args[0].uri.match(/^.+\/search\?q=\w+\&topic=(\w)+$/);
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
	else if (req.uri.pathname.split('/').slice(-1)[0] === 'spellcheck'){
		res.status(200).json({
			typos: []
		});
	}
	else if (req.uri.pathname.split('/').slice(-1)[0] === 'search'){
		res.status(200).json({
			items: [{
				url: 'test-url-1'
			},{
				url: 'test-url-2'
			},{
				url: 'test-url-3'
			}],
			count: 3
		});
	}
}

module.exports = {
	package: 'node-red-contrib-viseo/node-red-contrib-ms-search',
	generateInput: generateInput,
	policy: policy,
	setup: () => {
		// needed for VISEO components
		process.env.CONFIG_PATH = path.resolve(__dirname, 'exp-ms-search.config.js');
		process.env.NODE_ENV = 'dev';
		process.env.FRAMEWORK_ROOT = path.resolve(__dirname, '../test-packages/node-red-contrib-viseo/node_modules/node-red-viseo-bot-manager');
	},
	scenario: async (runtime, workload) => {
		workload.inputs.forEach(message => Object.values(message).forEach(item => { item.__expId = crypto.randomBytes(5).toString('hex'); }));

		runtime.setMockRemoteServer(mockServer);

		// We need to inject the following mock instance
		// for ms-* packages, as the auth node is not available
		const authInstance = runtime.createCustomInstance('ms-auth', function(config){
			this.authenticate = callback => callback(this);
		});
		authInstance.credentials = {
			key: 'test-ms-key'
		};

		const config1 = {
			key: authInstance.id,
			api: 'post',
			input: 'text',
			inputType: 'msg',
			endpoint: 'endpoint',
			endpointType: 'msg'
		};
		const instance1 = runtime.createInstance('ms-spell-check', config1);

		const config2 = {
			key: authInstance.id,
			q: 'query',
			qType: 'msg',
			parameters: [ 'topic' ],
			topic: 'topic',
			topicType: 'msg'
		};
		const instance2 = runtime.createInstance('ms-cs-search', config2);

		helpers.createTestSinks(runtime, workload.labels || POSSIBLE_IDS, [ instance1, instance2 ]);

		await runtime.delay(100);

		// let testMsg = generateInput();
		// instance1.emit('input', testMsg[instance1.type]);
		// instance2.emit('input', testMsg[instance2.type]);

		for (let message of workload.inputs){
			instance1.emit('input', message[instance1.type]);
			instance2.emit('input', message[instance2.type]);

			if (workload.interval){
				await runtime.delay(workload.interval);
			}
		}
	}
}