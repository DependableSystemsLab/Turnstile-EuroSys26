if (process.argv.length < 3){
	console.log('Provide the name of the experiment (found in ./experiments) and the result output directory path');
	console.log('node run-experiment.js amazon-echo experiment-results/');
	process.exit(1);
};

const expScript = process.argv[2];
const workloadName = process.argv[3] || '';
process.env.INSTRUMENT_ALL = process.argv[4] || false;

const path = require('path');
const fs = require('fs');
const TestDriver = require('./TestDriver.js');
const Instrumentor = require('../../src/Instrumentor.js');

const TARGET_APP_ROOT = process.env.ANALYSIS_TARGETS_ROOT;
const OUTPUT_ROOT = process.env.TURNSTILE_OUTPUT_ROOT;
const EXP_ROOT = path.resolve(__dirname, 'workloads');

const currentTime = new Date(); 
const datestamp = currentTime.toISOString().substring(0,10);
const timestamp = currentTime.toISOString().substring(0,19).replace(/\:/g, '-').replace('T', '-');
const outputDir = path.join(OUTPUT_ROOT, 'exp-' + datestamp);
const outputPath = path.resolve(outputDir, 'result.' + expScript + '.' + (workloadName ? workloadName + '.' : '') + timestamp + '.json');

fs.mkdirSync(outputDir, { recursive: true });

const instrument = (absSourcePath, policy) => {
	const instOutPath = absSourcePath + '.inst.js';

	console.log(`Instrumenting ${absSourcePath}...`);

	const instrumented = Instrumentor.instrument(absSourcePath, policy);

	fs.writeFileSync(instOutPath, instrumented, 'utf8');

	// console.log(`  ... wrote instrumented code to ${instOutPath}`);
	return instOutPath;
}

// main

(async () => {
	// initialize mock runtime
	const runtime = new TestDriver.MockNodeRedRuntime();

	// load experiment settings
	const experiment = require(path.join(EXP_ROOT, 'exp-' + expScript + '.js'));

	// load workload file
	const workloadPath = path.join(EXP_ROOT, 'exp-' + expScript + '.workload' + (workloadName ? '-' + workloadName : '') + '.json');
	let workload = JSON.parse(fs.readFileSync(workloadPath, 'utf8'));

	// override the default policy rules, if workload defines custom rules
	if (workload.rules){
		experiment.policy.rules = workload.rules;
	}

	// configure the tracker for the runtime
	runtime.configureTracker(experiment.policy);

	// execute experiment setup function (if exists)
	if (experiment.setup instanceof Function){
		experiment.setup();
	}

	//
	// Stage 1: Experiment with regular application
	//
	console.log('\n\n---[ Stage 1: Started ]---\n');
	runtime.disableEdgeChecks();

	// load the target application
	const packagePath = path.join(process.env.ANALYSIS_TARGETS_ROOT, experiment.package);
	runtime.loadPackage(packagePath);

	// run the experiment scenario with the workload
	const result = await runtime.runTestScenario(experiment.scenario, workload);

	// console.log(result.summary);

	// await runtime.delay(1000);

	console.log('\n---[ Stage 1: Finished ]---');

	runtime.printResults(result);

	//
	// Stage 2: Experiment with instrumented application
	//
	console.log('\n\n---[ Stage 2: Started ]---\n');

	// instrument the experiment target source code
	const instrumentedFileList = runtime.files.map(filePath => instrument(filePath,  experiment.policy));

	runtime.reset();

	// re-load the experiment workload
	workload = JSON.parse(fs.readFileSync(workloadPath, 'utf8'));

	// load the instrumented application
	runtime.loadPackage(instrumentedFileList);

	// run the experiment scenario with the workload
	const result2 = await runtime.runTestScenario(experiment.scenario, workload);

	// await runtime.delay(1000);

	console.log('\n---[ Stage 2: Finished ]---');
	
	// console.log(result2.summary);
	runtime.printResults(result2);

	fs.writeFileSync(outputPath, JSON.stringify({
		app_name: expScript,
		workload: {
			name: workloadName || 'Default',
			interval: workload.interval,
			labels: workload.labels,
			rules: workload.rules
		},
		exhaustive: JSON.parse(process.env.INSTRUMENT_ALL),
		results: [ result, result2 ]
	}));

	console.log(`---\n\nRelative Run-time: ${(result2.elapsed / result.elapsed)}\n\n---[ Finished running ${expScript} ${workloadName}]---`);

	process.exit();
})();