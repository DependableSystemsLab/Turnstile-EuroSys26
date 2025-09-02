const cluster = require('cluster');
const path = require('path');
const fs = require('fs');
const jsBeautify = require('js-beautify');
const CodeAnalyzer = require('../../src/CodeAnalyzer.js');

const expressPlugin = require('../../src/plugins/plugin-express.js');
const nodeRedPlugin = require('../../src/plugins/plugin-node-red.js');

const outputRoot = process.env.TURNSTILE_OUTPUT_ROOT || '.';
const timestamp = (new Date()).toISOString().substring(0,19).replace(/\:/g, '-').replace('T', '-');

// We use cluster to run the analysis in a separate worker process,
// so that CodeAnalyzer's caching effects can be eliminated from repeated runs.
if (cluster.isPrimary){

	if (process.argv.length < 3){
		console.log('Provide the repository list to analyze');
		console.log('e.g., node run-turnstile-analysis.js /path/to/repo-list');
		process.exit(1);
	};

	// const sourcePath = process.argv[2];
	// const outputPath = process.argv[3];

	const repoListPath = process.argv[2];
	const repoList = fs.readFileSync(repoListPath, 'utf8').split('\n').filter(line => !!line);

	// const logPath = path.join(__filename, '.log');
	const outputPath = path.resolve(outputRoot, `turnstile-taint-analysis-result.${timestamp}.csv`);

	const CONFIDENCE_Z = {
	  '80': 1.282,
	  '85': 1.440,
	  '90': 1.645,
	  '95': 1.960,
	  '99': 2.576,
	  '99.5': 2.807,
	  '99.9': 3.291
	}

	function getStatistics(vals, conf = 95){
	  var min = Infinity, max = -Infinity;
	  var mean = vals.reduce(function(acc, item){ 
	    if (item < min) min = item;
	    if (item > max) max = item;
	    return item + acc
	  }, 0) / vals.length;
	  var stdev = Math.sqrt( vals.reduce(function(acc, item){ return acc + Math.pow(item - mean, 2) }, 0) / vals.length );
	  var confidence = CONFIDENCE_Z[String(conf)] * stdev / Math.sqrt(vals.length);
	  return {
	    min: min,
	    max: max,
	    mean: mean,
	    stdev: stdev,
	    confidence: confidence
	  }
	}

	function runAnalyzer(sourcePath){
		return new Promise((resolve, reject) => {
			const worker = cluster.fork();
			worker.on('message', result => {
				resolve({ stats: result });
				worker.kill();
			});
			worker.send(sourcePath);
		});
	}

	(async () => {
		for (let repoPath of repoList){
			const sourcePath = path.resolve(process.env.ANALYSIS_TARGETS_ROOT, repoPath);

			console.log('\n' + sourcePath);

			// repeat the analysis
			let analysis;
			const timelogs = {
				elapsed: [],
				elapsed_tree: [],
				elapsed_graph: [],
				elapsed_flow: []
			}

			for (let i = 0; i < 10; i ++){
				analysis = await runAnalyzer(sourcePath);

				process.stdout.write(analysis.stats.elapsed + 'ms, ');

				timelogs.elapsed.push(analysis.stats.elapsed);
				timelogs.elapsed_tree.push(analysis.stats.elapsed_tree);
				timelogs.elapsed_graph.push(analysis.stats.elapsed_graph);
				timelogs.elapsed_flow.push(analysis.stats.elapsed_flow);
			}

			const timeStats = {
				elapsed: getStatistics(timelogs.elapsed),
				elapsed_tree: getStatistics(timelogs.elapsed_tree),
				elapsed_graph: getStatistics(timelogs.elapsed_graph),
				elapsed_flow: getStatistics(timelogs.elapsed_flow)
			}

			/*
			console.log(`=== Analysis of ${sourcePath} ===

			Flags:
			    STRICT   = ${analysis.stats.strict_mode}
			    DEEP     = ${analysis.stats.deep_mode}

			Started At:    ${(new Date(analysis.stats.started_at)).toLocaleString()}
			Elapsed:       ${analysis.stats.elapsed} ms
			    Stage 1:   ${analysis.stats.elapsed_tree} ms
			    Stage 2:   ${analysis.stats.elapsed_graph} ms
			    Stage 3:   ${analysis.stats.elapsed_flow} ms

			IO Entities:
			    Sources  = ${analysis.stats.io.source}
			    Sinks    = ${analysis.stats.io.sink}

			IO->IO Flows:
			    Distinct individual paths   = ${analysis.stats.flowsUpstream.length}
			    Duplicate sub-paths removed = ${Object.keys(analysis.stats.flowsFromSource).length} distinct sources lead to ${Object.values(analysis.stats.flowsFromSource).reduce((acc, flows) => {
			    		flows.forEach(flow => acc.add(flow[flow.length - 1].id));
			    		return acc;
			    	return acc;
			    }, new Set()).size} distinct sinks

			==========================================

			Flow Details:

			------------------------------------------
			Upstream Flows Found
			(Flows ending up in ${Object.keys(analysis.stats.flowsFromSink).length} sinks, duplicate sources removed):

			${Object.values(analysis.stats.flowsFromSink).map(flows => {
				const sink = flows[0][0];
				const sources = Object.values(flows.reduce((acc, flow) => {
					acc[flow[flow.length - 1].id] = flow[flow.length - 1];
					return acc;
				}, {})).map(source => {
					return `      <- ${source.node.type} at Line ${source.node.loc.start.line}, Column ${source.node.loc.start.column}, in ${path.basename(source.scope.$root.absSourcePath)}`
				}).join('\n');
				return `* ${sink.node.type} at Line ${sink.node.loc.start.line}, Column ${sink.node.loc.start.column}, in ${path.basename(sink.scope.$root.absSourcePath)}\n${sources}`;
			}).join('\n\n')}


			------------------------------------------
			Downstream Flows Found
			(Flows starting from ${Object.keys(analysis.stats.flowsFromSource).length} sources, duplicate sinks removed):

			${Object.values(analysis.stats.flowsFromSource).map(flows => {
				const source = flows[0][0];
				const sinks = Object.values(flows.reduce((acc, flow) => {
					acc[flow[flow.length - 1].id] = flow[flow.length - 1];
					return acc;
				}, {})).map(sink => {
					return `      -> ${sink.node.type} at Line ${sink.node.loc.start.line}, Column ${sink.node.loc.start.column}, in ${path.basename(sink.scope.$root.absSourcePath)}`
				}).join('\n');
				return `* ${source.node.type} at Line ${source.node.loc.start.line}, Column ${source.node.loc.start.column}, in ${path.basename(source.scope.$root.absSourcePath)}\n${sinks}`;
			}).join('\n\n')}
			`);
			*/

			const basePath = path.basename(sourcePath);

			await fs.promises.appendFile(outputPath, [basePath, Object.keys(analysis.stats.flowsFromSink).length, Object.keys(analysis.stats.flowsFromSource).length, timeStats.elapsed.mean, timeStats.elapsed.confidence, timeStats.elapsed_tree.mean, timeStats.elapsed_tree.confidence, timeStats.elapsed_graph.mean, timeStats.elapsed_graph.confidence, timeStats.elapsed_flow.mean, timeStats.elapsed_flow.confidence ].join(',') + '\n', 'utf8');

			console.log(`\nResults written to ${outputPath}`);
		}

		process.exit();

	})();

}
else {
	// Analysis Worker

	// suppress analysis logs
	console.log = function(){};

	process.on('message', sourcePath => {
		const analysis = CodeAnalyzer.analyze(sourcePath, {
			strict: false,
			deep: false
		}, [ expressPlugin, nodeRedPlugin ]);

		process.send(analysis.stats);
	});
}