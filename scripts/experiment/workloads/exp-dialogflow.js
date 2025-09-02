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
		'node-dialogflow-handoff': {
			message: {
				available: {
					surfaces: {
						list: [{
							capabilities: {
								list: [{
									name: 'get'
								}, {
									name: 'add'
								}, {
									name: 'upd'
								}]
							}
						}]
					}
				}
			},
			x: labels.pickRandom()
		},
		'dialogflow': {
			itemid: labels.pickRandom(),
			object: {
				group: labels.pickRandom()
			}
		}
	}
};

const policy = {
	labellers: {
		node: node => node.config.table,
		data3: data => data.x ? data.x : undefined,
		data4: data => data.itemid ? data.itemid : undefined,
		service: {
			invoke: (obj, args) => {
				const match = args[0].uri.match(/^https:\/\/[\w\.-\/]+\/entities\/(\w)+\?v=20150910$/);
				return match ? match[1] : 'A';
			}
		},
		body: item => (() => {
			return JSON.parse(item.body).group
		})
	},
	rules: [
		'A -> B',
		'B -> C'
	]
}

const mockServer = (req, res) => {
	if (req.uri.pathname.split('/').slice(-1)[0] === 'query'){
		res.status(200).send(JSON.stringify({
			result: {
				resolvedQuery: {},
				action: {},
				score: 1,
				parameters: []
			}
		}));
	}
	else if (req.uri.pathname.split('/').slice(-2)[0] === 'entities'){
		res.status(200).send(JSON.stringify({
			result: {
				resolvedQuery: {},
				action: {},
				score: 1,
				parameters: []
			}
		}));
	}
}

module.exports = {
	package: 'node-red-contrib-viseo/node-red-contrib-dialogflow',
	generateInput: generateInput,
	policy: policy,
	setup: () => {
		// needed for VISEO components
		process.env.CONFIG_PATH = path.resolve(__dirname, 'exp-dialogflow.config.js');
		process.env.NODE_ENV = 'dev';
		process.env.FRAMEWORK_ROOT = '../../node-red-viseo-bot-manager';
	},
	scenario: async (runtime, workload) => {
		workload.inputs.forEach(message => Object.values(message).forEach(item => { item.__expId = crypto.randomBytes(5).toString('hex'); }));
		
		runtime.setMockRemoteServer(mockServer);

		runtime.applyNodeSettings('dialogflow-config', {
			credentials: {
				clienttoken: 'test-client-token',
				devtoken: 'test-dev-token'
			}
		});

		const config1 = {};
		const node1 = runtime.createInstance('dialogflow-config', config1);

		const config2 = {};
		const node2 = runtime.createInstance('dialogflow-server', config2);

		const config3 = {
			capab: JSON.stringify(['get', 'add', 'upd'])
		};
		const node3 = runtime.createInstance('node-dialogflow-handoff', config3);

		const config4 = {
			tokenv1: node1.id,
			action: 'manage',
			itemid: 'itemid',
			itemidType: 'msg',
			object: 'object',
			objectType: 'msg',
			selaction: 'upd',
			actionitemaddupd: 'upd-entities'
		};
		const node4 = runtime.createInstance('dialogflow', config4);

		helpers.createTestSinks(runtime, workload.labels || POSSIBLE_IDS, [ node3, node4 ]);

		await runtime.delay(100);

		// let testMsg = generateInput();
		// node3.emit('input', testMsg['node-dialogflow-handoff']);
		// node4.emit('input', testMsg['dialogflow']);

		for (let message of workload.inputs){
			node3.emit('input', message['node-dialogflow-handoff']);
			node4.emit('input', message['dialogflow']);

			if (workload.interval){
				await runtime.delay(workload.interval);
			}
		}
		
	}
}