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
		'ms-qna': {
			host: 'https://test.api.cognitive.microsoft.com',
			knowledgeBaseId: labels.pickRandom(),
			endpoint: labels.pickRandom(),
			text: 'test-text',
			question: 'test-text'
		},
		'ms-luis': {
			host: 'https://test.api.cognitive.microsoft.com',
			knowledgeBaseId: 'test-kb-id',
			text: labels.pickRandom()
		},
		'ms-text-analytics': {
			input: {
				src: labels.pickRandom(),
				dst: labels.pickRandom()
			},
			host: 'https://test.api.cognitive.microsoft.com',
			knowledgeBaseId: 'test-kb-id',
			text: 'test-text'
		}
	}
};

const policy = {
	labellers: {
		identity: i => i,
		node: node => node.config.table,
		dataQna: data => data.endpoint,
		dataLuis: data => data.text,
		dataTA: data => data.input.src,
		qna: {
			invoke: (obj, args) => {
				const match = args[0].uri.match(/^.+\/knowledgebases\/(\w)+\/generateAnswer$/);
				return match ? match[1] : 'A';
			}
		},
		luis: {
			invoke: (obj, args) => {
				const match = args[0].uri.match(/^.+query=(\w)$/);
				return match ? match[1] : 'A';
			}
		},
		TA: {
			invoke: (obj, args) => {
				return args[0].body.dst || 'A';
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
	else if (req.uri.path.split('/').slice(-1)[0] === 'generateAnswer'){
		res.status(200).json({
			answers: [{
				answer: 'Test Answer'
			}]
		});
	}
	else if (req.uri.path.split('/').slice(-1)[0] === 'keyPhrases'){
		res.status(200).json({
			phrases: [{
				phrase: 'Test Phrase'
			}]
		});
	}
	else if (req.uri.pathname.split('/').slice(-1)[0] === 'predict'){
		res.status(200).json({
			prediction: {
				entities: {
					$instance: {
						'abcd': [{
							type: 'ABCD',
							text: 'This is ABCD 1',
							startIndex: 0,
							length: 100
						}, {
							type: 'ABCD',
							text: 'This is ABCD 2',
							startIndex: 100,
							length: 100
						}, {
							type: 'ABCD',
							text: 'This is ABCD 3',
							startIndex: 200,
							length: 100
						}]
					},
					'ABCD': [{
						type: 'ABCD',
						text: 'This is ABCD 1',
						startIndex: 0,
						length: 100
					}, {
						type: 'ABCD',
						text: 'This is ABCD 2',
						startIndex: 100,
						length: 100
					}, {
						type: 'ABCD',
						text: 'This is ABCD 3',
						startIndex: 200,
						length: 100
					}]
				},
				topIntent: 'top-intent',
				intents: {
					'top-intent': {
						score: 80
					}
				}
			}
		});
	}
}

module.exports = {
	package: 'node-red-contrib-viseo/node-red-contrib-ms-language',
	generateInput: generateInput,
	policy: policy,
	setup: () => {
		// needed for VISEO components
		process.env.CONFIG_PATH = path.resolve(__dirname, 'exp-ms-language.config.js');
		process.env.NODE_ENV = 'dev';
		process.env.FRAMEWORK_ROOT = path.resolve(__dirname, '../test-packages/node-red-contrib-viseo/node_modules/node-red-viseo-bot-manager');
	},
	scenario: async (runtime, workload) => {
		workload.inputs.forEach(message => Object.values(message).forEach(item => { item.__expId = crypto.randomBytes(5).toString('hex'); }));

		runtime.setMockRemoteServer(mockServer);
		
		runtime.applyNodeSettings('ms-qna', {
			credentials: {
				endpointKey: 'endpoint',
				key: 'test-key'
			},
			location: 'us-east',
			way: 'key'
		});

		const config1 = {
			host: 'host',
			hostType: 'msg',
			knowledgeBaseId: 'knowledgeBaseId',
			knowledgeType: 'msg',
			question: 'question',
			questionType: 'msg',
			endpointKey: 'endpoint',
			endpointKeyType: 'msg',
			output: 'payload'
		};
		const instance1 = runtime.createInstance('ms-qna', config1);

		const config2 = {
			config: instance1.id,
			text: 'text',
			textType: 'msg'
		};
		const instance2 = runtime.createInstance('ms-luis', config2);

		const config3 = {
			key: instance1.id,
			input: 'input',
			inputType: 'msg'
		};
		const instance3 = runtime.createInstance('ms-text-analytics', config3);

		helpers.createTestSinks(runtime, workload.labels || POSSIBLE_IDS, [ instance1, instance2, instance3 ]);

		await runtime.delay(100);

		// let testMsg = generateInput();
		// instance1.emit('input', testMsg[instance1.type]);
		// instance2.emit('input', testMsg[instance2.type]);
		// instance3.emit('input', testMsg[instance3.type]);

		for (let message of workload.inputs){
			instance1.emit('input', message[instance1.type]);
			instance2.emit('input', message[instance2.type]);
			instance3.emit('input', message[instance3.type]);

			if (workload.interval){
				await runtime.delay(workload.interval);
			}
		}
	}
}