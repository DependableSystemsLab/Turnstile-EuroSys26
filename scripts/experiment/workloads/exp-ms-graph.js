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
		'ms-graph': {
			x: labels.pickRandom(),
			token: labels.pickRandom()
		},
		'ms-graph-excel': {
			token: labels.pickRandom(),
			session: labels.pickRandom(),
			workbook: labels.pickRandom(),
			worksheet: labels.pickRandom(),
			range: 'A1:C10',
			input: [[ labels.pickRandom(), 2, 3], [ 4, 5, 6], [7, 8, 9]]
		}
	}
};

const policy = {
	labellers: {
		node: node => node.config.table,
		data1: data => data.token,
		data2: data => data.input[0][0],
		service: {
			invoke: (obj, args) => {
				const match = args[0].uri.match(/^.+\/worksheets\/(\w)+\/range.+$/);
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
	else if (req.uri.path.split('/').slice(-2)[0] === 'me'){
		const tokenLabel = req.headers['Authorization'].split(' ')[1];
		res.status(200).json({
			name: tokenLabel
		});
	}
}

module.exports = {
	package: 'node-red-contrib-viseo/node-red-contrib-ms-graph',
	generateInput: generateInput,
	policy: policy,
	setup: () => {
		// needed for VISEO components
		process.env.CONFIG_PATH = path.resolve(__dirname, 'exp-ms-graph.config.js');
		process.env.NODE_ENV = 'dev';
		process.env.FRAMEWORK_ROOT = path.resolve(__dirname, '../test-packages/node-red-contrib-viseo/node_modules/node-red-viseo-bot-manager');
	},
	scenario: async (runtime, workload) => {
		workload.inputs.forEach(message => Object.values(message).forEach(item => { item.__expId = crypto.randomBytes(5).toString('hex'); }));

		runtime.setMockRemoteServer(mockServer);
		
		runtime.applyNodeSettings('ms-graph-config', {
			credentials: {
				clientid: 'test-clientid',
				clientsecret: 'test-clientsecret'
			}
		});

		const config1 = {};
		const instance1 = runtime.createInstance('ms-graph-config', config1);

		runtime.applyNodeSettings('ms-graph', {
			credentials: {
				redirect: 'test-redirect',
				username: 'test-username',
				password: 'test-password'
			}
		});

		const config2 = {
			config: instance1.id,
			action: 'user',
			redirect: 'redirect',
			redirectType: 'msg',
			state: 'state',
			stateType: 'msg',
			scope: 'scope',
			scopeType: 'scopeType',
			authority: 'authority',
			authorityType: 'msg',
			output: 'payload',
			outputType: 'msg',
			token: 'token',
			tokenType: 'msg'
		};
		const instance2 = runtime.createInstance('ms-graph', config2);

		const config3 = {
			token: 'token',
			tokenType: 'msg',
			session: 'session',
			sessionType: 'msg',
			workbook: 'workbook',
			workbookType: 'msg',
			worksheet: 'worksheet',
			worksheetType: 'msg',
			range: 'range',
			rangeType: 'msg',
			input: 'input',
			inputType: 'msg',
			selfields: ['a', 'b', 'c'],
			outputType: 'msg'
		};
		const instance3 = runtime.createInstance('ms-graph-excel', config3);

		helpers.createTestSinks(runtime, workload.labels || POSSIBLE_IDS, [ instance2, instance3 ]);

		await runtime.delay(100);


		// let testMsg = generateInput();
		// instance2.emit('input', testMsg['ms-graph']);
		// instance3.emit('input', testMsg['ms-graph-excel']);

		for (let message of workload.inputs){
			instance2.emit('input', message['ms-graph']);
			instance3.emit('input', message['ms-graph-excel']);

			if (workload.interval){
				await runtime.delay(workload.interval);
			}
		}

		await runtime.delay(100);
	}
}