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
		x: labels.pickRandom(),
		y: labels.pickRandom(),
		command: `sox input.wav ${labels.pickRandom()}.mp3 gain -n`
	}
};

const policy = {
	labellers: {
		data: data => data.x,
		output: data => (() => data.stdout)
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
	else if (req.uri.path.split('/').slice(-1)[0] === 'command'){
		res.status(200).json([ 'move', 'spin', 'shake' ]);
	}
}

module.exports = {
	package: 'node-red-contrib-viseo/node-red-contrib-sox',
	generateInput: generateInput,
	policy: policy,
	setup: () => {
		// needed for VISEO components
		process.env.CONFIG_PATH = path.resolve(__dirname, 'exp-sox.config.js');
		process.env.NODE_ENV = 'dev';
		process.env.FRAMEWORK_ROOT = path.resolve(__dirname, '../test-packages/node-red-contrib-viseo/node_modules/node-red-viseo-bot-manager');
	},
	scenario: async (runtime, workload) => {
		runtime.setMockRemoteServer(mockServer);
		runtime.setMockExecutable('sox', (args) => {
			const output = args[2][0];

			return {
				stdout: Buffer.from(output),
				stderr: `sox WARN rate: rate clipped 164 samples; decrease volume?
sox WARN dither: dither clipped 136 samples; decrease volume?
sox INFO sox: Overwriting 'output.mp3'
sox INFO sox: 'input.wav' - Input file has 2 channels
sox INFO sox: 'output.mp3' - Output file has 2 channels
sox INFO sox: 'input.wav' - Input file: 44100 Hz, 16-bit, stereo
sox INFO sox: 'output.mp3' - Output file: 44100 Hz, 16-bit, stereo
sox INFO sox:  2008000 samples in 6.78 seconds; 29588 samples/second
`
			}
		});
		
		runtime.applyNodeSettings('sox-command', {
			credentials: {
			}
		});

		const config1 = {
			cmd: 'command',
			cmdType: 'msg'
		};
		const instance1 = runtime.createInstance('sox-command', config1);

		helpers.createTestSinks(runtime, workload.labels || POSSIBLE_IDS, [ instance1 ]);

		await runtime.delay(100);

		// Object.values(runtime.instances).forEach(instance => {
		// 	let testMsg = generateInput();
		// 	instance.emit('input', testMsg);
		// });

		for (let message of workload.inputs){
			instance1.emit('input', message);
			
			if (workload.interval){
				await runtime.delay(workload.interval);
			}
		}
	}
}