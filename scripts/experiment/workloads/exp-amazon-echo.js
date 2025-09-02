// Note: set countAtScenarioBegin = 4 in TestDriver.js for this experiment
//       (the bluebird package creates an additional Promise)
process.env.TEST_DRIVER_INITIAL_ASYNC_LEVEL = 4;
const helpers = require('./helpers.js');

const POSSIBLE_NODE_IDS = [
	'light-outdoor',
	'light-office',
	'light-private'
];

const generateInput = (labels) => {
	if (!labels){
		labels = POSSIBLE_NODE_IDS;
	}
	else {
		labels = labels.map(label => 'light-' + label);
	}

	return {
		payload: {
			nodeid: labels.pickRandom(),
			"on":false,
			"bri":254,
			"percentage":100,
			"hue":0,
			"sat":254,
			"xy": [0.6484272236872118,0.33085610147277794],
			"ct":199,
			"rgb":[254,0,0],
			"colormode":"ct"
		}
	}
};

const policy = {
	labellers: {
		input: msg => (() => (msg.deviceid ? msg.deviceid.split('-').slice(-1)[0] : 'outdoor')),
		output: item => item.config.id.split('-').slice(-1)[0],
		request: req => req.headers['user-agent'],
		response: res => res.req.headers['user-agent']
	},
	rules: [
		'outdoor -> office',
		'office -> private'
	]
}

module.exports = {
	package: 'node-red-contrib-amazon-echo',
	generateInput: generateInput,
	policy: policy,
	scenario: async (runtime, workload) => {

		const hubConfig = {
			port: 3000,
			id: '',
			processinput: 2
		};

		let labels = POSSIBLE_NODE_IDS;
		if (workload.labels){
			labels = workload.labels.map(label => 'light-' + label);
		}

		const hubNode = runtime.createInstance('amazon-echo-hub', hubConfig);

		labels.forEach(label => {
			const deviceConfig = {
				id: label,
				topic: 'test-topic'
			};
			const deviceNode = runtime.createInstance('amazon-echo-device', deviceConfig);
			runtime.connectNodes(hubNode, deviceNode);
		});

		// const deviceConfig1 = {
		// 	id: 'light-outdoor',
		// 	topic: 'test-topic'
		// };
		// const deviceConfig2 = {
		// 	id: 'light-office',
		// 	topic: 'test-topic'
		// };
		// const deviceConfig3 = {
		// 	id: 'light-private',
		// 	topic: 'test-topic'
		// };

		// const deviceNode1 = runtime.createInstance('amazon-echo-device', deviceConfig1);
		// const deviceNode2 = runtime.createInstance('amazon-echo-device', deviceConfig2);
		// const deviceNode3 = runtime.createInstance('amazon-echo-device', deviceConfig3);

		// runtime.connectNodes(hubNode, deviceNode1);
		// runtime.connectNodes(hubNode, deviceNode2);
		// runtime.connectNodes(hubNode, deviceNode3);

		await runtime.delay(100);

		for (let message of workload.inputs){
			hubNode.emit('input', message);

			if (workload.interval){
				await runtime.delay(workload.interval);
			}
		}

		await runtime.delay(100);

		runtime.closeAllSockets();
	}
}