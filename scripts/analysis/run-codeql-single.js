/*
 * Dependencies: CodeQL CLI v.2.16.5 (`codeql` binary must be added to the PATH)
 */
if (process.argv.length < 3){
	console.log('Provide the repository name to analyze');
	console.log('e.g., node run-codeql-single.js node-red-contrib-example');
	process.exit(1);
}

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const util = require('util');
const child_process = require('child_process');
const exec = util.promisify(child_process.exec);

const outputRoot = process.env.TURNSTILE_OUTPUT_ROOT || '.';

const repoPath = process.argv[2];
const flattenedPath = repoPath.replace(/\//g, '.');
const outputPath = path.resolve(outputRoot, path.join('codeql-analysis.' + flattenedPath + '.csv'));

const CODEQL_DB_ROOT = process.env.CODEQL_DB_ROOT;
const CODEQL_QUERY_PATH = path.resolve(__dirname, '../../codeql/default-suite.qls');
const FLOWSUP_QUERY_ID = 'DependableSystemsLab/turnstile-js/flows-upstream';
const FLOWSDOWN_QUERY_ID = 'DependableSystemsLab/turnstile-js/flows-downstream';

const result = {};

(async () => {

	const repoAbsPath = path.resolve(process.env.ANALYSIS_TARGETS_ROOT, repoPath);

	console.log(`Begin analyzing ${repoAbsPath}`);

	const t1 = Date.now();

	const codeqlDbPath = path.join(CODEQL_DB_ROOT, flattenedPath);

	console.log(`  ... creating codeql database at ${codeqlDbPath}`);

	const dbCreateResult = await exec(`codeql database create ${codeqlDbPath} --language=javascript --overwrite`, { cwd: repoAbsPath });

	const t2 = Date.now();

	console.log(`  ... finished in ${((t2 - t1) / 1000)} seconds`);

	const codeqlOutputPath = path.join(CODEQL_DB_ROOT, flattenedPath + '.sarif');

	console.log(`  ... analyzing codeql database at ${codeqlDbPath}`);

	const analyzeResult = await exec(`codeql database analyze --rerun --format=sarif-latest --output=${codeqlOutputPath} ${codeqlDbPath} ${CODEQL_QUERY_PATH}`, { cwd: repoAbsPath });

	const t3 = Date.now();

	console.log(`  ... finished in ${((t3 - t2) / 1000)} seconds`);

	console.log(`  ... reading codeql result from ${codeqlOutputPath}`);

	const sarif = JSON.parse(fs.readFileSync(codeqlOutputPath, 'utf8'));

	const elapsed = t3 - t1;

	const flowsUpstream = sarif.runs[0].results.filter(item => item.ruleId === FLOWSUP_QUERY_ID);
	const flowsDownstream = sarif.runs[0].results.filter(item => item.ruleId === FLOWSDOWN_QUERY_ID);

	console.log(`Elapsed = ${elapsed} ms
    DB creation = ${t2 - t1} ms
    DB analysis = ${t3 - t2} ms

---------------------------------------
Upstream Flows Found (total ${flowsUpstream.length})

${flowsUpstream.map(item => `  ${item.locations[0].physicalLocation.artifactLocation.uri}, Line ${item.locations[0].physicalLocation.region.startLine}`).join('\n')}


---------------------------------------
Downstream Flows Found (total ${flowsDownstream.length})

${flowsDownstream.map(item => `  ${item.locations[0].physicalLocation.artifactLocation.uri}, Line ${item.locations[0].physicalLocation.region.startLine}`).join('\n')}

`);

	// await fs.promises.appendFile(outputPath, repoPath + ',' + VULNERABILITIES.map(vul => result[vul]).join(',') + '\n', 'utf8');

	process.exit();

})();