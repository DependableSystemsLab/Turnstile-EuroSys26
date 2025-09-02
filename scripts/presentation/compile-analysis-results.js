if (process.argv.length < 4){
	console.log('Provide the results CSV for Turnstile and CodeQL');
	console.log('Usage: node compile-analysis-results.js turnstile-analysis-result.csv codeql-analysis-result.csv');
	process.exit(1);
}

const path = require('path');
const fs = require('fs');

const turnstileResultPath = process.argv[2];
const codeqlResultPath = process.argv[3];

const manualResultPath = path.join(process.env.TURNSTILE_ROOT, 'data/analysis/dataflows-manual.csv');

const outputRoot = process.env.TURNSTILE_OUTPUT_ROOT || '.';
const timestamp = (new Date()).toISOString().substring(0,19).replace(/\:/g, '-').replace('T', '-');
const outputPath = path.resolve(outputRoot, `taint-analysis-compiled.${timestamp}.csv`);

console.log(`Compiling results from ${turnstileResultPath} and ${codeqlResultPath}`);

function readResults(filepath){
	const content = fs.readFileSync(filepath, 'utf8').split('\n').map(line => line.split(',')).filter(row => row.length >= 2);
	return content.reduce((acc, row) => {
		acc[row[0]] = parseInt(row[1]) + (row[2] ? parseInt(row[2]) : 0);
		return acc;
	}, {});
}

const turnstileResult = readResults(turnstileResultPath);
const codeqlResult = readResults(codeqlResultPath);
const manualResult = readResults(manualResultPath);

const compiled = [[ 'Application', 'Turnstile', 'CodeQL', 'Manual']];

Object.keys(manualResult).forEach(key => {
	compiled.push([ key, turnstileResult[key], codeqlResult[key], manualResult[key] ]);
});

const csvContent = compiled.map(item => item.join(',')).join('\n');
fs.writeFileSync(outputPath, csvContent);

console.log(`--- Compiled results file at ${outputPath} ---

Now you can plot the results by (make sure to activate venv):

  python plot-line-dataflows.py ${outputPath}

`);