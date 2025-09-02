if (process.argv.length < 3){
	console.log('provide the compiled JSON containing the experiment data');
	console.log('Usage: node extract-area-data.js exp-results-compiled.json');
	process.exit(1);
}

const path = require('path');
const fs = require('fs');

const compiledPath = process.argv[2];

const outputRoot = process.env.TURNSTILE_OUTPUT_ROOT || '.';
const timestamp = (new Date()).toISOString().substring(0,19).replace(/\:/g, '-').replace('T', '-');
const outputPath = path.resolve(outputRoot, `plot-area-data.${timestamp}.csv`);

const compiled = JSON.parse(fs.readFileSync(compiledPath, 'utf8'));

const frequencies = new Map();

compiled.forEach((item) => {
	item.workloads.forEach(result => {
		const frequency = 1000 / result.interval;

		if (!frequencies.has(frequency)){
			frequencies.set(frequency, {
				selective: {},
				exhaustive: {}
			});
		}

		const frequencyList = frequencies.get(frequency);

		if (result.exhaustive){
			if (!frequencyList.exhaustive[item.app_name]){
				frequencyList.exhaustive[item.app_name] = [];
			}

			frequencyList.exhaustive[item.app_name].push(result.tm_elapsed / result.og_elapsed);
		}
		else {
			if (!frequencyList.selective[item.app_name]){
				frequencyList.selective[item.app_name] = [];
			}

			frequencyList.selective[item.app_name].push(result.tm_elapsed / result.og_elapsed);
		}
	});
}, {});

const sortedFreq = Array.from(frequencies.entries()).sort((a, b) => a[0] - b[0]);

const csvContent = [[
	'Frequency',
	'Selective-Min',
	'Selective-Med',
	'Selective-Max',
	'Exhaustive-Min',
	'Exhaustive-Med',
	'Exhaustive-Max'
]];

sortedFreq.forEach(entry => {
	const selective = Object.values(entry[1].selective).map(items => items.reduce((acc, val) => acc + val, 0) / items.length).sort((a, b) => a - b);
	const exhaustive = Object.values(entry[1].exhaustive).map(items => items.reduce((acc, val) => acc + val, 0) / items.length).sort((a, b) => a - b);
	
	const sMin = selective[0];
	const sMedian = getMedian(selective);
	const sMax = selective[selective.length - 1];

	const eMin = exhaustive[0];
	const eMedian = getMedian(exhaustive);
	const eMax = exhaustive[exhaustive.length - 1];

	csvContent.push([ entry[0], sMin, sMedian, sMax, eMin, eMedian, eMax ]);
});

fs.writeFileSync(outputPath, csvContent.map(row => row.join(',')).join('\n'));

console.log(`--- Saved bar plot data at ${outputPath} ---

Now you can plot the results by (make sure to activate venv):

  python plot-area-applications.py ${outputPath}

`);

function getMedian(list){
	return list.length % 2 === 0 ? ((list[list.length / 2 - 1] + list[list.length / 2]) / 2) : list[Math.floor(list.length / 2)];
}