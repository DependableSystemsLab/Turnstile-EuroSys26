const path = require('path');
const crypto = require('crypto');
const url = require('url');
const helpers = require('./helpers.js');

const POSSIBLE_IDS = [
	'A',
	'B',
	'C'
];

const generateInput = (labels = POSSIBLE_IDS) => {
	return {
		x: labels.pickRandom(),
		config: 'https://inbenta-example.org/abcdefg',
		rating: 10,
		comment: labels.pickRandom()
	}
};

const policy = {
	labellers: {
		node: node => node.config.table,
		data: data => data.x,
		service: {
			invoke: (obj, args) => {
				const match = args[0].match(/^https:\/\/.+idata=10(\w+)$/);
				return match ? match[1] : 'A';
			}
		}
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
	else if (req.uri.pathname === '/abcdefg/'){
		res.status(200).json([ 'move', 'spin', 'shake' ]);
	}
}

module.exports = {
	package: 'node-red-contrib-viseo/node-red-contrib-inbenta',
	generateInput: generateInput,
	policy: policy,
	setup: () => {
		// needed for VISEO components
		process.env.CONFIG_PATH = path.resolve(__dirname, 'exp-inbenta.config.js');
		process.env.NODE_ENV = 'dev';
		process.env.FRAMEWORK_ROOT = path.resolve(__dirname, '../test-packages/node-red-contrib-viseo/node_modules/node-red-viseo-bot-manager');
	},
	scenario: async (runtime, workload) => {
		runtime.setMockRemoteServer(mockServer);
		
		runtime.applyNodeSettings('inbenta-request', {
			credentials: {}
		});

		const config = {
			ibConfig: 'config',
			ibConfigType: 'msg',
			question: 'question',
			questionType: 'msg',
			objectRating: 'rating',
			objectRatingType: 'msg',
			objectComment: 'comment',
			objectCommentType: 'msg',
			action: 'rate'
		};
		const instance = runtime.createInstance('inbenta-request', config);

		helpers.createTestSinks(runtime, workload.labels || POSSIBLE_IDS, [ instance ]);

		await runtime.delay(100);

		// let testMsg = generateInput();
		// instance.emit('input', testMsg);

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