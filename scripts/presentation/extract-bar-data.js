if (process.argv.length < 3){
	console.log('provide the compiled JSON containing the experiment data');
	console.log('Usage: node extract-bar-data.js exp-results-compiled.json');
	process.exit(1);
}

const path = require('path');
const fs = require('fs');

const compiledPath = process.argv[2];

const outputRoot = process.env.TURNSTILE_OUTPUT_ROOT || '.';
const timestamp = (new Date()).toISOString().substring(0,19).replace(/\:/g, '-').replace('T', '-');
const outputPath = path.resolve(outputRoot, `plot-bar-data.${timestamp}.csv`);

const compiled = JSON.parse(fs.readFileSync(compiledPath, 'utf8'));

const csvContent = [[ 'Application',
	'Baseline',
	'Selectively-managed (30Hz)',
	'Selectively-managed (250Hz)',
	'Exhaustively-managed (30Hz)',
	'Exhaustively-managed (250Hz)']];

compiled.forEach((item) => {
	let sm30, sm250, em30, em250;
	
	item.workloads.forEach(result => {
		if (result.exhaustive){
			if (result.interval === 33){
				em30 = result.tm_elapsed / result.og_elapsed;
			}
			else if (result.interval === 4){
				em250 = result.tm_elapsed / result.og_elapsed;
			}
		}
		else {
			if (result.interval === 33){
				sm30 = result.tm_elapsed / result.og_elapsed;
			}
			else if (result.interval === 4){
				sm250 = result.tm_elapsed / result.og_elapsed;
			}
		}
	});

	csvContent.push([ item.app_name, 1, sm30, sm250, em30, em250 ]);
}, {});

fs.writeFileSync(outputPath, csvContent.map(row => row.join(',')).join('\n'));

console.log(`--- Saved bar plot data at ${outputPath} ---

Now you can plot the results by (make sure to activate venv):

  python plot-bar-applications.py ${outputPath}

`);