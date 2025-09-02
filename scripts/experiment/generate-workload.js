if (process.argv.length < 3){
	console.log('Provide the name of the experiment (found in ./workloads/EXPERIMENT_LIST.txt)');
	console.log('Usage: node generate-workload.js amazon-echo');
	process.exit(1);
};

const expScript = process.argv[2];
const workloadSize = parseInt(process.argv[3]) || 1000;
const labelCount = parseInt(process.argv[4]) || 3;
const inputInterval = parseInt(process.argv[5]) || 0;
const ruleType = process.argv[6] || "vertical";
const workloadName = process.argv[7] || '';

const path = require('path');
const fs = require('fs');

const EXP_ROOT = path.resolve(__dirname, 'workloads');
const outputPath = path.join(EXP_ROOT, 'exp-' + expScript + '.workload' + (workloadName ? '-' + workloadName : '') +'.json');

const TREE_PATTERN = /tree\.(\d+)\.(\d+)/;
const getTreeNodeCount = (depth, branching) => {
	let sum = 0; 
	for (let i = 0; i < depth; i++){
		sum += Math.pow(branching, i);
	}
	return sum;
}

// main

(async () => {
	const experiment = require(path.join(EXP_ROOT, 'exp-' + expScript + '.js'));
	const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').slice(0, labelCount);

	const workload = {
		interval: inputInterval,
		labels: labels,
		rules: [],
		inputs: []
	};

	if (!ruleType || ruleType === 'vertical'){
		for (let i = 0; i < labelCount - 1; i ++){
			workload.rules.push(`${labels[i]} -> ${labels[1 + i]}`);
		}
	}
	else if (ruleType === 'horizontal'){
		for (let i = 0; i < labelCount - 1; i ++){
			workload.rules.push(`${labels[i]} -> ${labels[labelCount - 1]}`);
		}
	}
	else if (TREE_PATTERN.test(ruleType)){
		const treeArgs = ruleType.match(TREE_PATTERN);
		const treeDepth = parseInt(treeArgs[1]);
		const treeBranching = parseInt(treeArgs[2]);
		if (treeDepth < 2){
			console.log('minimal tree depth is 2');
			return process.exit();
		}

		if (treeBranching < 1){
			console.log('minimal tree branching is 1');
			return process.exit();
		}

		const treeLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').slice(0, getTreeNodeCount(treeDepth, treeBranching));
		workload.labels = treeLabels;

		let levelOffset = 0;
		for (let i = 0; i < treeDepth - 1; i ++){
			let level = treeDepth - i - 1;
			let levelNodes = Math.pow(treeBranching, level);
			for (let j = 0; j < levelNodes; j++){
				let parentNode = levelOffset + levelNodes + Math.floor(j / treeBranching);
				workload.rules.push(`${treeLabels[levelOffset + j]} -> ${treeLabels[parentNode]}`);
			}
			levelOffset += levelNodes;
		}
	}

	for (let i = 0; i < workloadSize; i++){
		workload.inputs.push(experiment.generateInput(workload.labels));
	}

	await fs.promises.writeFile(outputPath, JSON.stringify(workload), 'utf8');
	
	console.log(`---[ Generated Workload "${workloadName}" at ${outputPath} ]---`);
	
	process.exit();
})();