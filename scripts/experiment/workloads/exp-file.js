const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const helpers = require('./helpers.js');

const TEST_XLSX_FILE = fs.readFileSync(path.resolve(__dirname, 'exp-file-test-workbook.xlsx'));

const POSSIBLE_IDS = [
	'A',
	'B',
	'C'
];

const generateInput = (labels = POSSIBLE_IDS) => {
	return {
		'log-line': {
			user: {
				id: labels.pickRandom(),
				name: labels.pickRandom() + labels.pickRandom() + labels.pickRandom(),
				address: {
					carrier: labels.pickRandom(),
					conversation: {
						id: labels.pickRandom()
					}
				}
			}
		},
		'get-lines': {
			x: labels.pickRandom()
		},
		'file-xlsx': {
			x: labels.pickRandom(),
			workbook: 'test-workbook.xlsx',
			worksheet: 'Sheet1',
			range: 'A1:C10',
			input: [[ labels.pickRandom(), 2, 3], [ labels.pickRandom(), 5, 6], [7, 8, 9]]
		}
	}
};

const policy = {
	labellers: {
		node: node => node.config.table,
		data: data => data.x,
		dataLog: data => data.user.id,
		dataXlsx: data => data.x,
		xlsxInput: data => (() => {
			return (data[1] && data[1][0]) ? data[1][0] : 'A';
		}),
		xlsx: {
			invoke: (obj, args, func) => {
				if (func.name === 'writeFileSync'){
					return args[0].Sheets['Sheet1'].A1.v;
				}
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
	else if (req.uri.path.split('/').slice(-1)[0] === 'command'){
		res.status(200).json([ 'move', 'spin', 'shake' ]);
	}
}

module.exports = {
	package: 'node-red-contrib-viseo/node-red-contrib-file',
	generateInput: generateInput,
	policy: policy,
	setup: () => {
		// needed for VISEO components
		process.env.CONFIG_PATH = path.resolve(__dirname, 'exp-file.config.js');
		process.env.NODE_ENV = 'dev';
		process.env.FRAMEWORK_ROOT = path.resolve(__dirname, '../test-packages/node-red-contrib-viseo/node_modules/node-red-viseo-bot-manager');
	},
	scenario: async (runtime, workload) => {
		workload.inputs.forEach(message => Object.values(message).forEach(item => { item.__expId = crypto.randomBytes(5).toString('hex'); }));

		runtime.setMockFile('test-log.log', `A\n1236455,209535,230593`);
		runtime.setMockDirectory('.', [
			'test-log-2023-09-01.log',
			'test-log-2023-10-01.log',
			'test-log-2023-11-01.log',
			'test-log-2023-12-01.log',
			'test-log-2024-01-01.log',
			'test-log-2024-02-01.log',
			'test-log-2024-03-01.log',
			'test-log-2024-04-01.log',
			'test-log-2024-05-01.log',
			'test-log-2024-06-01.log'
		]);
		runtime.setMockFile('test-workbook.xlsx', TEST_XLSX_FILE);

		runtime.applyNodeSettings('log-line-config', {
			credentials: {
				path: 'test-log.log'
			}
		});
		const config1 = {
			fields: [{
				typed: 'date'
			},{
				typed: 'option_date'
			},{
				typed: 'option_carr'
			},{
				typed: 'option_conv'
			},{
				typed: 'option_userid'
			},{
				typed: 'option_userna'
			}],
			add: true,
			keep: 5
		};
		const instance1 = runtime.createInstance('log-line-config', config1);

		const config2 = {
			config: instance1.id
		};
		const instance2 = runtime.createInstance('log-line', config2);

		const config3 = {
			lines: 100,
			linesType: 'num',
			file: 'test-log.log'
		};
		const instance3 = runtime.createInstance('get-lines', config3);

		const config4 = {
			workbook: 'workbook',
			workbookType: 'msg',
			worksheet: 'worksheet',
			worksheetType: 'msg',
			range: 'range',
			rangeType: 'msg',
			input: 'input',
			inputType: 'msg',
			selfields: ['a', 'b', 'c']
		};
		const instance4 = runtime.createInstance('file-xlsx', config4);

		helpers.createTestSinks(runtime, workload.labels || POSSIBLE_IDS, [ instance2, instance3 ]);

		await runtime.delay(100);

		// let testMsg = generateInput();
		// instance2.emit('input', testMsg['log-line']);
		// instance3.emit('input', testMsg['get-lines']);
		// instance4.emit('input', testMsg['file-xlsx']);

		for (let message of workload.inputs){
			// instance2.emit('input', message['log-line']);
			instance3.emit('input', message['get-lines']);
			instance4.emit('input', message['file-xlsx']);

			if (workload.interval){
				await runtime.delay(workload.interval);
			}
		}

		await runtime.delay(100);

		// console.log(runtime.getMockFileSystem());
	}
}