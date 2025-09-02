if (process.argv.length < 3){
	console.log('Provide the repository name to analyze');
	console.log('e.g., node run-turnstile-analysis-single.js node-red-contrib-example');
	process.exit(1);
};

const repoPath = process.argv[2];

const path = require('path');
const fs = require('fs');
const jsBeautify = require('js-beautify');
const CodeAnalyzer = require('../../src/CodeAnalyzer.js');

const expressPlugin = require('../../src/plugins/plugin-express.js');
const nodeRedPlugin = require('../../src/plugins/plugin-node-red.js');

const outputRoot = process.env.TURNSTILE_OUTPUT_ROOT || '.';

const flattenedPath = repoPath.replace(/\//g, '.');
const repoAbsPath = path.resolve(process.env.ANALYSIS_TARGETS_ROOT, repoPath);
const outputPath = path.resolve(outputRoot, path.join('analysis.' + flattenedPath + '.html'));

const analysis = CodeAnalyzer.analyze(repoAbsPath, {
	strict: false,
	deep: false
}, [ expressPlugin, nodeRedPlugin ]);

console.log(`=== Analysis of ${repoAbsPath} ===

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

const html = CodeAnalyzer.generateHtmlViewer(analysis);
fs.writeFileSync(outputPath, html, 'utf8');