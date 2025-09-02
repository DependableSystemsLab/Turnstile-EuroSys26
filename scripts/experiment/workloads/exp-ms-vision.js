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
		'ms-video-indexer': {
			x: labels.pickRandom(),
			y: labels.pickRandom(),
			group: labels.pickRandom(),
			body: JSON.stringify({
				name: labels.pickRandom()
			})
		},
		'vision-image-describe': {
			group: labels.pickRandom(),
			image: Buffer.from(JSON.stringify({
				src: labels.pickRandom(),
				dst: labels.pickRandom()
			}))
		},
		'vision-image-faces': {
			group: labels.pickRandom(),
			region: labels.pickRandom()
		}
	}
};

const policy = {
	labellers: {
		dataIndexer: data => JSON.parse(data.body).name,
		dataID: data => JSON.parse(String(data.image)).src,
		dataFaces: data => data.group,
		indexer: {
			invoke: (obj, args) => {
				const match = args[0].uri.match(/^.+\/Accounts\?group=(\w)+$/);
				return match ? match[1] : 'A';
			}
		},
		describe: {
			invoke: (obj, args) => {
				const info = JSON.parse(args[0].body.toString());
				return info.dst;
			}
		},
		faces: {
			invoke: (obj, args) => {
				return args[0].body.region;
			}
		}
	},
	rules: [
		'A -> B',
		'B -> C'
	]
}

const mockServer = labels => ((req, res) => {
	if (req.uri.path === '/login'){
		res.status(200).json({
			token: crypto.randomBytes(10).toString('hex')
		});
	}
	else if (req.uri.pathname.split('/').slice(-1)[0] === 'Search'){
		res.status(200).json({
			item: labels.pickRandom(),
			label: labels.pickRandom()
		});
	}
	else if (req.uri.pathname.split('/').slice(-1)[0] === 'photo'){
		res.status(200).json({
			processed: labels.pickRandom(),
			label: labels.pickRandom()
		});
	}
	else if (req.uri.pathname.split('/').slice(-1)[0] === 'analyze'){
		res.status(200).json({
			result: labels.pickRandom(),
			label: labels.pickRandom()
		});
	}
})

module.exports = {
	package: 'node-red-contrib-viseo/node-red-contrib-ms-vision',
	generateInput: generateInput,
	policy: policy,
	setup: () => {
		// needed for VISEO components
		process.env.CONFIG_PATH = path.resolve(__dirname, 'exp-ms-vision.config.js');
		process.env.NODE_ENV = 'dev';
		process.env.FRAMEWORK_ROOT = path.resolve(__dirname, '../test-packages/node-red-contrib-viseo/node_modules/node-red-viseo-bot-manager');
	},
	scenario: async (runtime, workload) => {
		workload.inputs.forEach(message => Object.values(message).forEach(item => { item.__expId = crypto.randomBytes(5).toString('hex'); }));
		
		runtime.setMockRemoteServer(mockServer(workload.labels || POSSIBLE_IDS));
		
		// We need to inject the following mock instance
		// for ms-* packages, as the auth node is not available
		const authInstance = runtime.createCustomInstance('ms-auth', function(config){
			this.authenticate = callback => callback(this);
		});
		authInstance.credentials = {
			key: 'test-key',
			region: 'westus'
		};

		const config1 = {
			key: authInstance.id,
			object: 'Accounts',
			action: 'POST',
			contt: 'contt',
			conttType: 'msg',
			body: 'body',
			bodyType: 'msg',
			parameters: {
				'group': { value: 'group', typedInput: 'msg' }
			}
		};
		const instance1 = runtime.createInstance('ms-video-indexer', config1);

		const config2 = {
			image: 'image',
			imageT: 'msg'
		};
		const instance2 = runtime.createInstance('vision-image-describe', config2);

		const config3 = {
			facekey: authInstance.id,
			request: 'put_photo',
			parameters: [ 'posX', 'posY', 'group', 'region' ],
			posX: 'posX',
			posXType: 'msg',
			posY: 'posY',
			posYType: 'msg',
			group: 'group',
			groupType: 'msg',
			region: 'region',
			regionType: 'msg'
		};
		const instance3 = runtime.createInstance('vision-image-faces', config3);

		helpers.createTestSinks(runtime, workload.labels || POSSIBLE_IDS, [ instance1, instance2, instance3 ]);

		await runtime.delay(100);

		// let testMsg = generateInput();
		// instance1.emit('input', testMsg[instance1.type]);
		// instance2.emit('input', testMsg[instance2.type]);
		// instance3.emit('input', testMsg[instance3.type]);

		for (let message of workload.inputs){
			message['vision-image-describe'].image = Buffer.from(message['vision-image-describe'].image);

			instance1.emit('input', message[instance1.type]);
			instance2.emit('input', message[instance2.type]);
			instance3.emit('input', message[instance3.type]);

			if (workload.interval){
				await runtime.delay(workload.interval);
			}
		}
	}
}