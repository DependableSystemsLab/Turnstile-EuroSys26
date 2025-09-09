#!/bin/bash

filename=./workloads/EXPERIMENT_LIST.txt

export NODE_OPTIONS=--max-old-space-size=6000

# Check if the file exists
if [ ! -f "$filename" ]; then
    echo "EXPERIMENT_LIST file not found"
    exit 1
fi

# Initialize line number
line_number=1

# Iterate through each line in the file
while IFS= read -r line
do
    exp_file=$(echo "$line" | tr -d '\r' | xargs)
    echo -e "\n\n========================================"
    echo "Starting Experiment $line_number: $exp_file"
    echo "----------------------------------------"
    
    node run-experiment.js $exp_file V3-2fps false
    node run-experiment.js $exp_file V3-5fps false
    node run-experiment.js $exp_file V3-10fps false
    node run-experiment.js $exp_file V3-20fps false
    node run-experiment.js $exp_file V3-30fps false
    node run-experiment.js $exp_file V3-40fps false
    node run-experiment.js $exp_file V3-50fps false
    node run-experiment.js $exp_file V3-59fps false
    node run-experiment.js $exp_file V3-71fps false
    node run-experiment.js $exp_file V3-83fps false
    node run-experiment.js $exp_file V3-91fps false
    node run-experiment.js $exp_file V3-100fps false
    node run-experiment.js $exp_file V3-200fps false
    node run-experiment.js $exp_file V3-250fps false
    node run-experiment.js $exp_file V3-500fps false
    node run-experiment.js $exp_file V3-1000fps false

    node run-experiment.js $exp_file V3-2fps true
    node run-experiment.js $exp_file V3-5fps true
    node run-experiment.js $exp_file V3-10fps true
    node run-experiment.js $exp_file V3-20fps true
    node run-experiment.js $exp_file V3-30fps true
    node run-experiment.js $exp_file V3-40fps true
    node run-experiment.js $exp_file V3-50fps true
    node run-experiment.js $exp_file V3-59fps true
    node run-experiment.js $exp_file V3-71fps true
    node run-experiment.js $exp_file V3-83fps true
    node run-experiment.js $exp_file V3-91fps true
    node run-experiment.js $exp_file V3-100fps true
    node run-experiment.js $exp_file V3-200fps true
    node run-experiment.js $exp_file V3-250fps true
    node run-experiment.js $exp_file V3-500fps true
    node run-experiment.js $exp_file V3-1000fps true
    
    echo "-----  FINISHED  -----------------------"
    ((line_number++))
done < "$filename"