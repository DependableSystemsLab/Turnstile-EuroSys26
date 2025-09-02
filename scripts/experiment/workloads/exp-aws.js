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
		'aws-lex': {
			payload: 'Test Payload',
			request: {
				attr1: 'test-1',
				attr2: 'test-2',
				x: labels.pickRandom(),
				y: labels.pickRandom()
			},
			session: {
				attr1: 'test-1',
				attr2: 'test-2'
			},
			userId: 'test-user'
		},
		'aws-rekognition': {
			image: {
				S3Object: {
					Bucket: 'test-bucket',
			        Name: 'test-name',
			        Version: '1'
				}
			},
			x: labels.pickRandom(),
			y: labels.pickRandom()
		}
	}
};

const policy = {
	labellers: {
		node: node => node.config.label,
		data: data => data.image ? data.x : (data.request ? data.request.x : 'A'),
		lexruntime: {
			'invoke': (obj, args) => args[0].requestAttributes.y
		},
		rekognition: {
			'invoke': (obj, args) => args[0].y
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
	else if (req.uri.path.split('/').slice(-1)[0] === 'text'){
		res.status(200).json({
			"intentName": 'test-intent',
			"slots": {
				attr1: 'attr1',
				attr2: 'attr2'
			},
			"sessionAttributes": req.body.session,
			"message": 'test message',
		});
	}
	else if (req.host === 'rekognition.us-east-1.amazonaws.com'){
		res.status(200).json({
			"FaceDetails": [{
				"BoundingBox": {
		          "Width": 320,
		          "Height": 650,
		          "Left": 35,
		          "Top": 98
		        },
		        "AgeRange": {
		          "Low": 25,
		          "High": 35
		        },
		        "Smile": {
		          "Value": true,
		          "Confidence": 0.756
		        },
		        "Eyeglasses": {
		          "Value": false,
		          "Confidence": 0.987
		        },
		        "Sunglasses": {
		          "Value": false,
		          "Confidence": 0.987
		        },
		        "Gender": {
		          "Value": 'male',
		          "Confidence": 0.811
		        },
		        "Beard": {
		          "Value": false,
		          "Confidence": 0.911
		        },
		        "Mustache": {
		          "Value": false,
		          "Confidence": 0.911
		        },
		        "EyesOpen": {
		          "Value": true,
		          "Confidence": 0.894
		        },
		        "MouthOpen": {
		          "Value": false,
		          "Confidence": 0.794
		        },
		        "Confidence": 0.865
		    }]
		});
	}
}

module.exports = {
	package: 'node-red-contrib-viseo/node-red-contrib-aws',
	generateInput: generateInput,
	policy: policy,
	setup: () => {
		// needed for VISEO components
		process.env.CONFIG_PATH = path.resolve(__dirname, 'exp-aws.config.js');
		process.env.NODE_ENV = 'dev';
		process.env.FRAMEWORK_ROOT = '../../node-red-viseo-bot-manager';
	},
	scenario: async (runtime, workload) => {
		workload.inputs.forEach(message => Object.values(message).forEach(item => { item.__expId = crypto.randomBytes(5).toString('hex'); }));
		
		runtime.setMockRemoteServer(mockServer);

		runtime.applyNodeSettings('aws-config', {
			credentials: {
				accessKeyId: 'test-key',
				secretAccessKey: 'test-key',
				region: 'us-east-1'
			}
		});

		const config1 = {};
		const node1 = runtime.createInstance('aws-config', config1);

		const config2 = {
			token: node1.id,
			botname: 'test-bot-name',
			botalias: 'test-bot-alias',
			inputType: 'msg',
			userid: 'userId',
			useridType: 'msg',
			requestA: 'request',
			sessionA: 'session',
			requestAType: 'msg'
		};
		const node2 = runtime.createInstance('aws-lex', config2);

		const config3 = {
			key: node1.id,
			parameters: [ 'Image' ],
			Image: 'image',
			ImageType: 'msg'
		};
		const node3 = runtime.createInstance('aws-rekognition', config3);

		helpers.createTestSinks(runtime, workload.labels || POSSIBLE_IDS, [ node2, node3 ]);

		await runtime.delay(100);

		// let testMsg = generateInput();
		// node2.emit('input', testMsg['aws-lex']);
		// node3.emit('input', testMsg['aws-rekognition']);

		for (let message of workload.inputs){
			node2.emit('input', message['aws-lex']);
			node3.emit('input', message['aws-rekognition']);

			if (workload.interval){
				await runtime.delay(workload.interval);
			}
		}
	}
}