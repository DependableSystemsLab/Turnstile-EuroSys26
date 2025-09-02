/*
 * Dependencies: CodeQL CLI v.2.16.5 (`codeql` binary must be added to the PATH)
 */
if (process.argv.length < 3){
	console.log('Provide the repository list to analyze');
	console.log('e.g., node run-codeql-analysis.js /path/to/repo-list');
	process.exit(1);
}

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const util = require('util');
const child_process = require('child_process');
const exec = util.promisify(child_process.exec);

const repoListPath = process.argv[2];
const repoList = fs.readFileSync(repoListPath, 'utf8').split('\n').filter(line => !!line);

const outputRoot = process.env.TURNSTILE_OUTPUT_ROOT || '.';
const timestamp = (new Date()).toISOString().substring(0,19).replace(/\:/g, '-').replace('T', '-');

const outputPath = path.resolve(outputRoot, `codeql-taint-analysis-result.${timestamp}.csv`);

const CODEQL_DB_ROOT = process.env.CODEQL_DB_ROOT;
const CODEQL_QUERY_PATH = path.resolve(__dirname, '../../codeql/default-suite.qls');
const FLOWSUP_QUERY_ID = 'DependableSystemsLab/turnstile-js/flows-upstream';
const FLOWSDOWN_QUERY_ID = 'DependableSystemsLab/turnstile-js/flows-downstream';

const result = {};

(async () => {

	for (let repoPath of repoList){
		const flattenedPath = repoPath.replace(/\//g, '.');

		const repoAbsPath = path.resolve(process.env.ANALYSIS_TARGETS_ROOT, repoPath);

		console.log(`\n\n=====================================`);
		console.log(`Begin analyzing ${repoAbsPath}`);

		const t1 = Date.now();

		const codeqlDbPath = path.join(CODEQL_DB_ROOT, flattenedPath);

		console.log(`  ... creating codeql database at ${codeqlDbPath}`);

		await exec(`codeql database create ${codeqlDbPath} --language=javascript --overwrite`, { cwd: repoAbsPath });

		const t2 = Date.now();

		console.log(`  ... finished in ${((t2 - t1) / 1000)} seconds`);

		const codeqlOutputPath = path.join(CODEQL_DB_ROOT, flattenedPath + '.sarif');

		console.log(`  ... analyzing codeql database at ${codeqlDbPath}`);

		await exec(`codeql database analyze --rerun --format=sarif-latest --output=${codeqlOutputPath} ${codeqlDbPath} ${CODEQL_QUERY_PATH}`, { cwd: repoAbsPath });

		const t3 = Date.now();

		console.log(`  ... finished in ${((t3 - t2) / 1000)} seconds`);

		// Rerun the analysis, because the time for the second run becomes faster due to caching

		console.log(`  ... (rerun) creating codeql database at ${codeqlDbPath}`);

		await exec(`codeql database create ${codeqlDbPath} --language=javascript --overwrite`, { cwd: repoAbsPath });

		const t4 = Date.now();

		console.log(`  ... (rerun) finished in ${((t4 - t3) / 1000)} seconds`);

		console.log(`  ... (rerun) analyzing codeql database at ${codeqlDbPath}`);

		await exec(`codeql database analyze --rerun --format=sarif-latest --output=${codeqlOutputPath} ${codeqlDbPath} ${CODEQL_QUERY_PATH}`, { cwd: repoAbsPath });

		const t5 = Date.now();

		console.log(`  ... (rerun) finished in ${((t5 - t4) / 1000)} seconds`);

		// Read the results
		console.log(`  ... reading codeql result from ${codeqlOutputPath}`);

		const sarif = JSON.parse(fs.readFileSync(codeqlOutputPath, 'utf8'));

		const elapsed1 = t3 - t1;
		const elapsed2 = t5 - t3;

		const flowsUpstream = sarif.runs[0].results.filter(item => item.ruleId === FLOWSUP_QUERY_ID);
		const flowsDownstream = sarif.runs[0].results.filter(item => item.ruleId === FLOWSDOWN_QUERY_ID);

		console.log(`\nElapsed (Run 1) = ${elapsed1} ms
    DB creation (Run 1) = ${t2 - t1} ms
    DB analysis (Run 1) = ${t3 - t2} ms

Elapsed (Run 2) = ${elapsed2} ms
    DB creation (Run 2) = ${t4 - t3} ms
    DB analysis (Run 2) = ${t5 - t4} ms

---------------------------------------
Upstream Flows Found (total ${flowsUpstream.length})

${flowsUpstream.map(item => `  ${item.locations[0].physicalLocation.artifactLocation.uri}, Line ${item.locations[0].physicalLocation.region.startLine}`).join('\n')}


---------------------------------------
Downstream Flows Found (total ${flowsDownstream.length})

${flowsDownstream.map(item => `  ${item.locations[0].physicalLocation.artifactLocation.uri}, Line ${item.locations[0].physicalLocation.region.startLine}`).join('\n')}

`);
		const basePath = path.basename(repoPath);

		await fs.promises.appendFile(outputPath, [basePath, flowsUpstream.length, flowsDownstream.length, elapsed1, t2 - t1, t3 - t2, elapsed2, t4 - t3, t5 - t4 ].join(',') + '\n', 'utf8');
	}

	process.exit();

})();