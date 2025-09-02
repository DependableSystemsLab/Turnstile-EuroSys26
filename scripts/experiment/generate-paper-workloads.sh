#!/bin/bash

filename=./workloads/EXPERIMENT_LIST.txt
workload_size=1000

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
    echo "Generating workload for Experiment $line_number: $exp_file"
    echo "----------------------------------------"
    
    node generate-workload.js $exp_file $workload_size 3 33 vertical
    node generate-workload.js $exp_file $workload_size 3 0 vertical Batch
    
    node generate-workload.js $exp_file $workload_size 3 500 vertical V3-2fps
    node generate-workload.js $exp_file $workload_size 3 200 vertical V3-5fps
    node generate-workload.js $exp_file $workload_size 3 100 vertical V3-10fps
    node generate-workload.js $exp_file $workload_size 3 50 vertical V3-20fps
    node generate-workload.js $exp_file $workload_size 3 33 vertical V3-30fps
    node generate-workload.js $exp_file $workload_size 3 25 vertical V3-40fps
    node generate-workload.js $exp_file $workload_size 3 20 vertical V3-50fps
    node generate-workload.js $exp_file $workload_size 3 17 vertical V3-59fps
    node generate-workload.js $exp_file $workload_size 3 14 vertical V3-71fps
    node generate-workload.js $exp_file $workload_size 3 12 vertical V3-83fps
    node generate-workload.js $exp_file $workload_size 3 11 vertical V3-91fps
    node generate-workload.js $exp_file $workload_size 3 10 vertical V3-100fps
    node generate-workload.js $exp_file $workload_size 3 5 vertical V3-200fps
    node generate-workload.js $exp_file $workload_size 3 4 vertical V3-250fps
    node generate-workload.js $exp_file $workload_size 3 2 vertical V3-500fps
    node generate-workload.js $exp_file $workload_size 3 1 vertical V3-1000fps

    echo "-----  FINISHED  -----------------------"
    ((line_number++))
done < "$filename"

