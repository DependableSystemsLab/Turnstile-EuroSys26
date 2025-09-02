if (process.argv.length < 3){
	console.log('provide one or more result directories');
	console.log('Usage: node compile-experiment-results.js exp-2025-08-30 exp-2025-08-31 exp-2025-09-01');
	process.exit(1);
}

const path = require('path');
const fs = require('fs');
const PrivacyTracker = require('../../src/PrivacyTracker.js');

const resultDirectories = process.argv.slice(2);

const outputRoot = process.env.TURNSTILE_OUTPUT_ROOT || '.';
const timestamp = (new Date()).toISOString().substring(0,19).replace(/\:/g, '-').replace('T', '-');
const outputPath = path.resolve(outputRoot, `exp-results-compiled.${timestamp}.json`);

const EXPERIMENT_LIST = fs.readFileSync(path.resolve(__dirname, '../experiment/workloads/EXPERIMENT_LIST.txt'), 'utf8').split('\n').map(item => item.trim()).filter(item => item);

const labelGetters = {
	'airtable': data => data.record.group,
	'amazon-echo': msg => msg.payload.nodeid,
	'aws': {
		'aws-lex': data => data.request.x,
		'aws-rekognition': data => data.x
	},
	'blink': data => data.x,
	'dialogflow': {
		'node-dialogflow-handoff': data => data.x,
		'dialogflow': data => data.itemid
	},
	'ffmpeg': data => data.x,
	'file-operation': data => data.path,
	'file': {
		'log-line': data => data.user.id,
		'get-lines': data => data.x
	},
	'google-actions': data => data.x,
	'google-maps': data => data.x,
	'help': data => data.x,
	'iadvize': data => data.x,
	'inbenta': data => data.x,
	'jimp': data => data.x,
	'lgtv': {
		'lgtv-app': data => data.payload,
		'lgtv-volume': data => data.payload,
		'lgtv-mute': data => data.payload,
		'lgtv-channel': data => data.payload
	},
	'modbus': {
		'modbus-server': data => data.x,
		'modbus-flex-server': data => data.x,
		'modbus-flex-connector': data => data.x,
		'modbus-queue-info': data => data.x,
		'modbus-response-filter': data => data.x
	},
	'ms-graph': {
		'ms-graph': data => data.token,
		'ms-graph-excel': data => data.input[0][0]
	},
	'ms-language': {
		'ms-qna': data => data.endpoint,
		'ms-luis': data => data.text,
		'ms-text-analytics': data => data.input.src
	},
	'ms-search': {
		'ms-spell-check': data => data.text,
		'ms-cs-search': data => data.query
	},
	'ms-speech': data => data.x,
	'ms-vision': {
		'ms-video-indexer': data => JSON.parse(data.body).name,
		'vision-image-describe': data => JSON.parse(String(Buffer.from(data.image))).src,
		'vision-image-faces': data => data.group
	},
	'nlp-js': data => data.x,
	'onvif-nodes': data => data.x,
	'soap': data => data.x,
	'sox': data => data.x,
	'trello': {
		'trello-in': data => data.x,
		'trello-card': data => JSON.parse(data.body).content
	},
	'watson': {
		'watson-conversation-v1-workspace-manager': data => data.payload.content,
		'watson-discovery-v1-document-loader': data => data.x,
		'watson-discovery-v1-query-builder': data => data.x,
		'watson-translator': data => data.payload
	}
}

const LABEL_PROPERTY = 'φlabel';
function tryExtractLabel(obj, circularTracker){
	if (!obj) return;
	if (!circularTracker){
        circularTracker = new Map();
    }

    if (circularTracker.has(obj)){
        return circularTracker.get(obj);
    }

    circularTracker.set(obj, null);

    let obj_label;

    if (obj[LABEL_PROPERTY]){
    	obj_label = obj[LABEL_PROPERTY];
    }
    else {
    	const combined = new Set();
    	Object.values(obj).forEach(child => {
    		const childLabel = tryExtractLabel(child, circularTracker);
    		if (childLabel){
    			if (childLabel instanceof Set){
    				childLabel.forEach(item => combined.add(item));
    			}
    			else if (typeof childLabel === 'string'){
    				combined.add(childLabel)
    			}
    		}
    	});

    	if (combined.size > 0){
    		obj_label = combined;
    	}
    }

    if (obj_label instanceof Function){
    	obj_label = obj_label(null, null, circularTracker);

    	if (obj_label && Object.getPrototypeOf(obj_label).constructor.name === 'PrimitiveObject'){
    		obj_label = obj_label.value;
    	}
    }

    return obj_label;
}

function processExperimentData(expResultFile, results){
	const content = JSON.parse(fs.readFileSync(expResultFile, 'utf8'));
	console.log(`\n----- Processing ${content.app_name} ${content.workload.name} -----`);

	let expResult = results.find(item => item.app_name === content.app_name);
	if (!expResult){
		expResult = {
			app_name: content.app_name,
			workloads: []
		};
		results.push(expResult);
	}

	console.log(`  reading experiment script: ${content.app_name}`);
	const experiment = require(path.resolve(__dirname, `../experiment/workloads/exp-${content.app_name}.js`));
	
	console.log(`  reading experiment workload: ${content.workload.name}`);
	const workloadPath = path.resolve(__dirname, `../experiment/workloads/exp-${content.app_name}.workload-${content.workload.name}.json`);
	const workload = JSON.parse(fs.readFileSync(workloadPath, 'utf8'));

	if (workload.rules){
		experiment.policy.rules = workload.rules;
	}

	const tracker = new PrivacyTracker();
	tracker.configure(experiment.policy);

	const inputs = workload.inputs.reduce((acc, input) => {
		const labelGetter = labelGetters[content.app_name];
		if (labelGetter instanceof Function){
			const label = labelGetter(input);
			if (!acc[label]){
				acc[label] = 0;
			}

			acc[label] ++;
		}
		else {
			Object.keys(labelGetter).forEach(key => {
				const label = labelGetter[key](input[key]);
				if (!acc[label]){
					acc[label] = 0;
				}
				acc[label] ++;
			});
		}

		return acc;
	}, {});

	const workloadResult = {
		exhaustive: content.exhaustive,
		interval: workload.interval,
		inputs: inputs,
		outputs: {},
		og_outputs: {},
		messages: {},
		og_messages: {},
		violations: {},
		nodes: {}
	};

	// add component summary
	const og_nodes = Object.keys(content.results[0].summary)
		.filter(id => id !== 'RED' && id !== 'fs' && id !== 'net')
		.map(key => content.results[0].summary[key]);
	const tm_nodes = Object.keys(content.results[1].summary)
		.filter(id => id !== 'RED' && id !== 'fs' && id !== 'net')
		.map(key => content.results[1].summary[key]);

	og_nodes.forEach(node => {
		if (!workloadResult.nodes[node.type]){
			workloadResult.nodes[node.type] = {
				original: {
					count: 0,
					inputCount: 0,
					httpInputCount: 0,
					outputCount: 0,
					processedCount: 0,
					avgProcessingTime: 0,
					totalProcessingTime: 0
				},
				managed: {
					count: 0,
					inputCount: 0,
					httpInputCount: 0,
					outputCount: 0,
					processedCount: 0,
					avgProcessingTime: 0,
					totalProcessingTime: 0
				}
			};
		}

		const nodeResult = workloadResult.nodes[node.type].original;

		nodeResult.count ++;
		nodeResult.inputCount += node.inputCount;
		nodeResult.httpInputCount += node.httpInputCount;
		nodeResult.outputCount += node.outputCount;
		nodeResult.processedCount += node.processedCount;
		nodeResult.avgProcessingTime = ((nodeResult.avgProcessingTime * (nodeResult.count - 1)) + node.avgProcessingTime) / nodeResult.count;
		nodeResult.totalProcessingTime += node.totalProcessingTime;
	});

	tm_nodes.forEach(node => {
		const nodeResult = workloadResult.nodes[node.type].managed;

		nodeResult.count ++;
		nodeResult.inputCount += node.inputCount;
		nodeResult.httpInputCount += node.httpInputCount;
		nodeResult.outputCount += node.outputCount;
		nodeResult.processedCount += node.processedCount;
		nodeResult.avgProcessingTime = ((nodeResult.avgProcessingTime * (nodeResult.count - 1)) + node.avgProcessingTime) / nodeResult.count;
		nodeResult.totalProcessingTime += node.totalProcessingTime;
	});

	const countMessages = (logs, outputResults, messageResults, violationResults) => {
		logs.forEach(log => {
			if (log.event.name === 'input'){
				let idMatch = log.emitter.id.match(/^sink-(\w+)$/);
				if (idMatch){
					if (!outputResults[idMatch[1]]){
						outputResults[idMatch[1]] = 0;
					}
					outputResults[idMatch[1]] ++;

					let messageLabel = tryExtractLabel(log.event.data[0]);
					messageLabel = tracker._extractHighestLabel(messageLabel);

					if (messageLabel){
						if (!messageResults[messageLabel]){
							messageResults[messageLabel] = {};
						}

						if (!messageResults[messageLabel][idMatch[1]]){
							messageResults[messageLabel][idMatch[1]] = 0;
						}

						messageResults[messageLabel][idMatch[1]] ++;
					}
					else {
						// if messageLabel does not exist, 
						// this result is from the unmanaged runtime
						// Try to extract the label using the input label getter
						const inputData = log.event.data[0] instanceof Array ? log.event.data[0].find(item => !!item) : log.event.data[0];
						const labelGetter = labelGetters[content.app_name];
						if (labelGetter instanceof Function){
							messageLabel = labelGetter(inputData);
						}
						else {
							for (let key in labelGetter){
								try {
									messageLabel = labelGetter[key](inputData);

									if (messageLabel) break;	
								}
								catch (err){
									// ignore
									continue;
								}
							}
						}

						if (messageLabel){
							if (!messageResults[messageLabel]){
								messageResults[messageLabel] = {};
							}

							if (!messageResults[messageLabel][idMatch[1]]){
								messageResults[messageLabel][idMatch[1]] = 0;
							}

							messageResults[messageLabel][idMatch[1]] ++;
						}
					}
				}
			}
			else if (log.event.name === '<policy-violation>'){
				const labels = log.event.data[0].labels;
				if (!violationResults[labels.source]){
					violationResults[labels.source] = {};
				}

				if (!violationResults[labels.source][labels.sink]){
					violationResults[labels.source][labels.sink] = 0;
				}

				violationResults[labels.source][labels.sink] ++;
			}
		});
	};

	countMessages(content.results[0].log, workloadResult.og_outputs, workloadResult.og_messages, {});

	countMessages(content.results[1].log, workloadResult.outputs, workloadResult.messages, workloadResult.violations);

	// data for original version
	workloadResult.og_nodes = og_nodes.length;
	workloadResult.og_elapsed = content.results[0].elapsed;
	workloadResult.og_fileRead = content.results[0].summary.fs.fileReadCount;
	workloadResult.og_fileWrite = content.results[0].summary.fs.fileWriteCount;
	workloadResult.og_dirRead = content.results[0].summary.fs.directoryReadCount;
	workloadResult.og_dirWrite = content.results[0].summary.fs.directoryWriteCount;
	workloadResult.og_httpReq = content.results[0].summary.net.httpRequestCount;
	workloadResult.og_udpSend = content.results[0].summary.net.udpSendCount;
	workloadResult.og_wsSend = content.results[0].summary.net.websocketSendCount;
	workloadResult.og_wsReceive = content.results[0].summary.net.websocketReceiveCount;
	workloadResult.og_posixInput = workloadResult.og_fileRead + workloadResult.og_dirRead;
	workloadResult.og_posixOutput = workloadResult.og_fileWrite + workloadResult.og_dirWrite + workloadResult.og_httpReq + workloadResult.og_udpSend;

	// data for turnstile-managed version
	workloadResult.tm_nodes = tm_nodes.length;
	workloadResult.tm_elapsed = content.results[1].elapsed;
	workloadResult.tm_checks = content.results[1].summary.RED.checkCount;
	workloadResult.tm_violations = content.results[1].summary.RED.policyViolations.total;
	workloadResult.tm_fileRead = content.results[1].summary.fs.fileReadCount;
	workloadResult.tm_fileWrite = content.results[1].summary.fs.fileWriteCount;
	workloadResult.tm_dirRead = content.results[1].summary.fs.directoryReadCount;
	workloadResult.tm_dirWrite = content.results[1].summary.fs.directoryWriteCount;
	workloadResult.tm_httpReq = content.results[1].summary.net.httpRequestCount;
	workloadResult.tm_udpSend = content.results[1].summary.net.udpSendCount;
	workloadResult.tm_wsSend = content.results[1].summary.net.websocketSendCount;
	workloadResult.tm_wsReceive = content.results[1].summary.net.websocketReceiveCount;
	workloadResult.tm_posixInput = workloadResult.tm_fileRead + workloadResult.tm_dirRead;
	workloadResult.tm_posixOutput = workloadResult.tm_fileWrite + workloadResult.tm_dirWrite + workloadResult.tm_httpReq + workloadResult.tm_udpSend;

	expResult.workloads.push(workloadResult);
}

const allResults = [];

for (let directory of resultDirectories){
	const directoryAbsPath = path.resolve(directory);
	const files = fs.readdirSync(directoryAbsPath, { withFileTypes: true });

	for (let item of files){
		if (item.isFile()){
			processExperimentData(path.join(directoryAbsPath, item.name), allResults);
		}
	}
}

fs.writeFileSync(outputPath, JSON.stringify(allResults));

console.log(`--- Compiled results file at ${outputPath} ---

You can now extract data for creating plots:

For the area plot:
  node extract-area-data.js ${outputPath}

For the bar plot:
  node extract-bar-data.js ${outputPath}

`);