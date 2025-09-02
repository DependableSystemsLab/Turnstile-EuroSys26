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
		'modbus-server': {
			payload: {
				address: 12345,
				register: ''
			},
			bufferData: crypto.randomBytes(20),
			bufferAddress: 100,
			x: labels.pickRandom(),
			y: labels.pickRandom()
		},
		'modbus-flex-server': {
			payload: {
				address: 12345,
				register: ''
			},
			bufferData: crypto.randomBytes(20),
			bufferAddress: 100,
			x: labels.pickRandom(),
			y: labels.pickRandom()
		},
		'modbus-flex-connector': {
			payload: {
				address: 12345,
				register: '',
				connectorType: 'test-connector'
			},
			bufferData: crypto.randomBytes(20),
			bufferAddress: 100,
			x: labels.pickRandom(),
			y: labels.pickRandom()
		},
		'modbus-queue-info': {
			payload: {
				address: 12345,
				register: ''
			},
			bufferData: crypto.randomBytes(20),
			bufferAddress: 100,
			x: labels.pickRandom(),
			y: labels.pickRandom()
		},
		'modbus-response-filter': {
			payload: [{
				name: 'test-filter',
				value: labels.pickRandom()
			}, {
				name: labels.pickRandom(),
				value: labels.pickRandom()
			}, {
				name: 'test-filter',
				value: labels.pickRandom()
			}],
			responseBuffer: crypto.randomBytes(20),
			bufferAddress: 100,
			x: labels.pickRandom(),
			y: labels.pickRandom()
		}
	}
};

const policy = {
	labellers: {
		dataServer: data => data.x,
		server: {
			invoke: (obj, args) => {
				return args[0].y;
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
	package: 'node-red-contrib-modbus',
	generateInput: generateInput,
	policy: policy,
	scenario: async (runtime, workload) => {
		workload.inputs.forEach(message => Object.values(message).forEach(item => { item.__expId = crypto.randomBytes(5).toString('hex'); }));
		
		runtime.setMockRemoteServer(mockServer);
		runtime.setMockFile('test-config-path', JSON.stringify([ 'test-config' ]))
		
		runtime.applyNodeSettings('modbus-server', {
			credentials: {}
		});

		const config0 = {
			name: 'modbus-client',
		      clienttype: 'tcp',
		      bufferCommands: true,
		      stateLogEnabled: false,
		      queueLogEnabled: false,
		      failureLogEnabled: true,
		      tcpHost: '127.0.0.1',
		      tcpPort: 502,
		      tcpType: 'DEFAULT',
		      serialPort: '/dev/ttyUSB',
		      serialType: 'RTU-BUFFERD',
		      serialBaudrate: 9600,
		      serialDatabits: 8,
		      serialStopbits: 1,
		      serialParity: 'none',
		      serialConnectionDelay: 100,
		      serialAsciiResponseStartDelimiter: '0x3A',
		      unit_id: 1,
		      commandDelay: 1,
		      clientTimeout: 1000,
		      reconnectOnTimeout: true,
		      reconnectTimeout: 2000,
		      parallelUnitIdsAllowed: true,
		      showErrors: false,
		      showWarnings: true,
		      showLogs: true
		};
		const instance0 = runtime.createInstance('modbus-client', config0);

		const config1 = {
			name: 'modbus-server',
			logEnabled: false,
			hostname: 'localhost',
			serverPort: 10502,
			responseDelay: 100,
			delayUnit: 'ms',
			coilsBufferSize: 10000,
			holdingBufferSize: 10000,
			inputBufferSize: 10000,
			discreteBufferSize: 10000,
			showErrors: false
		};
		const instance1 = runtime.createInstance('modbus-server', config1);

		const config2 = {
			name: 'modbus-flex-server',
			logEnabled: false,
			serverAddress: 'localhost',
			serverPort: 11502,
			responseDelay: 100,
			unitId: 1,
			delayUnit: 'ms',
			coilsBufferSize: 20000,
			registersBufferSize: 20000,
			minAddress: 0,
			splitAddress: 10000,
			showErrors: false
		};
		const instance2 = runtime.createInstance('modbus-flex-server', config2);

		const config3 = {
			name: 'modbus-flex-connector',
			maxReconnectsPerMinute: 4,
			emptyQueue: false,
			showStatusActivities: false,
			showErrors: false,
			server: instance0.id
		};
		const instance3 = runtime.createInstance('modbus-flex-connector', config3);

		const config4 = {
			name: 'modbus-queue-info',
            topic: 'test-topic',
            unitid: 1,
            queueReadIntervalTime: 1000,
            lowLowLevel: 25,
            lowLevel: 75,
            highLevel: 150,
            highHighLevel: 300,
			server: instance0.id,
            errorOnHighLevel: false,
            showStatusActivities: true,
            updateOnAllQueueChanges: false,
            updateOnAllUnitQueues: false
		};
		const instance4 = runtime.createInstance('modbus-queue-info', config4);

		const config5 = {
			name: 'modbus-io-config',
			path: 'test-config-path',
			format: 'utf8',
			addressOffset: 0
		};
		const instance5 = runtime.createInstance('modbus-io-config', config5);

		const config6 = {
			name: 'modbus-response-filter',
			filter: 'test-filter',
			registers: 0,
			ioFile: instance5.id,
			filterResponseBuffer: true,
			filterValues: true,
			filterInput: true,
			showStatusActivities: false,
			showErrors: false,
			showWarnings: true,
		};
		const instance6 = runtime.createInstance('modbus-response-filter', config6);

		helpers.createTestSinks(runtime, workload.labels || POSSIBLE_IDS, [ instance1, instance2, instance3, instance4, instance6 ]);

		await runtime.delay(100);

		instance0.connectClient();

		await runtime.delay(100);

		// let testMsg = generateInput();
		// instance1.emit('input', testMsg[instance1.type]);
		// instance2.emit('input', testMsg[instance2.type]);
		// instance3.emit('input', testMsg[instance3.type]);
		// instance4.emit('input', testMsg[instance4.type]);
		// instance6.emit('input', testMsg[instance6.type]);

		for (let message of workload.inputs.slice(0,20)){
			instance1.emit('input', message[instance1.type]);
			instance2.emit('input', message[instance2.type]);
			instance3.emit('input', message[instance3.type]);
			instance4.emit('input', message[instance4.type]);
			instance6.emit('input', message[instance6.type]);

			if (workload.interval){
				await runtime.delay(workload.interval);
			}
		}
	}
}