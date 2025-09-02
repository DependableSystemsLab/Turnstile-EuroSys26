// Note for this experiment:
// - This package uses a "catch-all" error handler to
//   format the error message, which ends up swallowing our
//   Turnstile-thrown SecurityViolation errors.
//   In the "reportError" function found in line 139 of
//   utilities/payload-utils.js (inside the package directory)
//   paste the following code at the top:
//
//   if (err && Object.getPrototypeOf(err).constructor.name === 'SecurityViolation'){
//       node.error(err);
//       return err;
//   }
//
// - In services/assistant/v1-workspace-manager.js,
//   The switch clauses fail to evaluate the PrimitiveObjects
//   that wrap the string values.
//   Here, we have to replace all "switch (method)" with 
//   "switch (method.toString())" to coerce the string values of
//   the PrimitiveObjects.
//
// - In line 49 of services/discovery/v1-document-loader.js,
//   The truthy check "if (response)" evaluates to true even if
//   the response is an empty string, because Turnstile turns the
//   string into a PrimitiveObject, which has a truthy value even when empty.
//   Here, we have to change the line to "if (response != '')".

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
		'watson-conversation-v1-workspace-manager': {
			params: {
				method: 'updateEntity',
				endpoint: 'test-endpoint',
				workspace_id: labels.pickRandom(),
				entity: 'test-entity'
			},
			payload: {
				content: labels.pickRandom()
			}
		},
		'watson-discovery-v1-document-loader': {
			discoveryparams: {
				environmentname: 'test-environment',
				environmentId: 'test-environment',
				collectionId: labels.pickRandom()
			},
			x: labels.pickRandom(),
			payload: crypto.randomBytes(100)
		},
		'watson-discovery-v1-query-builder': {
			discoveryparams: {
				environmentname: 'test-environment',
				environmentId: 'test-environment',
				collectionId: 'test-collection'
			},
			x: labels.pickRandom(),
			payload: crypto.randomBytes(100)
		},
		'watson-translator': {
			action: 'translate',
			domain: labels.pickRandom(),
			srclang: 'en',
			destlang: 'fr',
			payload: labels.pickRandom()
		}
	}
};

const policy = {
	labellers: {
		dataWM: data => data.payload.content,
		dataDL: data => data.x,
		dataQB: data => data.x,
		dataV3: data => data.payload,
		actionWM: {
			invoke: (obj, args) => {
				return args[3].params.workspace_id;
			}	
		},
		actionDL: {
			invoke: (obj, args) => {
				return args[0].collectionId
			}
		},
		actionV3: {
			invoke: (obj, args) => {
				return args[0].domain;
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
	else if (req.uri.path.split('/').slice(-1)[0] === 'token'){
		res.status(200).json({
			access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
		});
	}
	else if (req.uri.path.split('/').slice(-1)[0].split('?')[0] === 'translate'){
		res.status(200).json({
			translations: [{
				translation: 'Bonjour'
			}]
		});
	}
}

module.exports = {
	package: 'node-red-node-watson',
	generateInput: generateInput,
	policy: policy,
	scenario: async (runtime, workload) => {
		workload.inputs.forEach(message => Object.values(message).forEach(item => { item.__expId = crypto.randomBytes(5).toString('hex'); }));

		runtime.setMockRemoteServer(mockServer);
		
		runtime.applyNodeSettings('watson-conversation-v1-workspace-manager', {
			credentials: {
				apikey: 'test-watson-apikey'
			}
		});

		runtime.applyNodeSettings('watson-discovery-v1-document-loader', {
			credentials: {
				apikey: 'test-watson-apikey'
			}
		});

		runtime.applyNodeSettings('watson-discovery-v1-query-builder', {
			credentials: {
				apikey: 'test-watson-apikey'
			}
		});

		runtime.applyNodeSettings('watson-translator', {
			credentials: {
				apikey: 'test-watson-apikey'
			}
		});

		const config1 = {};
		const instance1 = runtime.createInstance('watson-conversation-v1-workspace-manager', config1);

		const config2 = {};
		const instance2 = runtime.createInstance('watson-discovery-v1-document-loader', config2);

		const config3 = {
			environment: 'test-environment'
		};
		const instance3 = runtime.createInstance('watson-discovery-v1-query-builder', config3);

		const config4 = {};
		const instance4 = runtime.createInstance('watson-translator', config4);

		helpers.createTestSinks(runtime, workload.labels || POSSIBLE_IDS, [ instance1, instance2, instance3, instance4 ]);

		await runtime.delay(100);

		// let testMsg = generateInput();
		// runtime.sendToNode(instance1, testMsg[instance1.type]);
		// runtime.sendToNode(instance2, testMsg[instance2.type]);
		// runtime.sendToNode(instance3, testMsg[instance3.type]);
		// runtime.sendToNode(instance4, testMsg[instance4.type]);

		for (let message of workload.inputs){
			runtime.sendToNode(instance1, message[instance1.type]);
			runtime.sendToNode(instance2, message[instance2.type]);
			runtime.sendToNode(instance3, message[instance3.type]);
			runtime.sendToNode(instance4, message[instance4.type]);
			
			if (workload.interval){
				await runtime.delay(workload.interval);
			}
		}
	}
}