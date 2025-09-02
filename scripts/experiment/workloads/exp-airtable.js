const helpers = require('./helpers.js');
const crypto = require('crypto');

const POSSIBLE_TABLE_IDS = [
	'table-public',
	'table-member',
	'table-vip'
];

const generateInput = (labels) => {
	if (!labels){
		labels = POSSIBLE_TABLE_IDS;
	}
	else {
		labels = labels.map(label => 'table-' + label);
	}

	return {
		table: labels.pickRandom(),
		record: {
			id: crypto.randomBytes(6).toString('hex'),
			group: labels.pickRandom()
		}
	}
};

const policy = {
	labellers: {
		node: node => node.config.table,
		data: data => data.record ? data.record.group.split('-').slice(-1)[0] : 'vip'
	},
	issuers: {
		airtable: obj => obj.name.split('-').slice(-1)[0]
	},
	rules: [
		'public -> member',
		'member -> vip'
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
	package: 'node-red-contrib-viseo/node-red-contrib-airtable',
	generateInput: generateInput,
	policy: policy,
	scenario: async (runtime, workload) => {
		runtime.setMockRemoteServer(mockServer);

		runtime.applyNodeSettings('node-config-airtable', {
			credentials: {
				app: 'test-app',
				key: 'test-key'
			}
		})

		const config1 = {};

		const node1 = runtime.createInstance('node-config-airtable', config1);

		const config2 = {
			auth: node1.id,
			table: 'table',
			tableType: 'msg',
			filterType: 'msg',
			record: 'record',
			recordType: 'msg',
			recordsType: 'msg',
			action: 'post',
			output: 'payload'
		};

		const node2 = runtime.createInstance('node-airtable', config2);

		helpers.createTestSinks(runtime, workload.labels || [ 'public', 'member', 'vip' ]);

		await runtime.delay(100);

		for (let message of workload.inputs){
			node2.emit('input', message);

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