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
		'trello-in': {
			x: labels.pickRandom(),
			path: {
				p: 'P',
				q: 'Q'
			}
		},
		'trello-card': {
			x: labels.pickRandom(),
			path: {
				p: labels.pickRandom(),
				q: 'Q'
			},
			query: labels.pickRandom(),
			body: JSON.stringify({
				content: labels.pickRandom()
			})
		}
	}
};

const policy = {
	labellers: {
		dataIn: data => data.x,
		dataCard: data => JSON.parse(data.body).content,
		serviceIn: {
			invoke: (obj, args) => {
				return 'A';
			}
		},
		serviceCard: {
			invoke: (obj, args) => {
				const match = args[0].uri.match(/^.+\/1\/(\w)+\/Q\?.+$/);
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
	else if (req.uri.pathname.split('/').slice(-2)[0] === 'webhooks'){
		res.status(200).json([ 'move', 'spin', 'shake' ]);
	}
	else if (req.uri.pathname.split('/').slice(-1)[0] === 'Q'){
		res.status(200).send(JSON.stringify(JSON.stringify({
			label: 'B'
		})));
	}
}

module.exports = {
	package: 'node-red-contrib-viseo/node-red-contrib-trello',
	generateInput: generateInput,
	policy: policy,
	setup: () => {
		// needed for VISEO components
		process.env.CONFIG_PATH = path.resolve(__dirname, 'exp-trello.config.js');
		process.env.NODE_ENV = 'dev';
		process.env.FRAMEWORK_ROOT = path.resolve(__dirname, '../test-packages/node-red-contrib-viseo/node_modules/node-red-viseo-bot-manager');
	},
	scenario: async (runtime, workload) => {
		workload.inputs.forEach(message => Object.values(message).forEach(item => { item.__expId = crypto.randomBytes(5).toString('hex'); }));
		
		runtime.setMockRemoteServer(mockServer);
		
		runtime.applyNodeSettings('trello-config', {
			credentials: {
				token: 'test-trello-token',
				key: 'test-trello-key'
			}
		});

		const config1 = {
		};
		const instance1 = runtime.createInstance('trello-config', config1);

		const config2 = {
			key: instance1.id
		};
		const instance2 = runtime.createInstance('trello-in', config2);

		const config3 = {
			key: instance1.id,
			sendreq: 'test-get',
			path: 'path',
			route: '/{p}/{q}',
			body: 'body',
			query: 'query'
		};
		const instance3 = runtime.createInstance('trello-card', config3);

		helpers.createTestSinks(runtime, workload.labels || POSSIBLE_IDS, [ instance2, instance3 ]);

		await runtime.delay(100);

		// let testMsg = generateInput();
		// instance2.emit('input', testMsg[instance2.type]);
		// instance3.emit('input', testMsg[instance3.type]);

		for (let message of workload.inputs){
			instance2.emit('input', message[instance2.type]);
			instance3.emit('input', message[instance3.type]);
			
			if (workload.interval){
				await runtime.delay(workload.interval);
			}
		}
	}
}