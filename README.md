## Turnstile -- EuroSys '26 Artifact

This repository contains the artifact for the EuroSys '26 paper:

> Turnstile: Hybrid Information Flow Control Framework for
  Managing Privacy in Internet-of-Things Applications


### Overview

This repository contains the following items:

* `src/` - The source code of Turnstile
* `codeql/` - The CodeQL query used to perform the comparative taint analysis against Turnstile (as described in Section 6.1 in the paper)
* `data/` - The original experimental data used to produce figures 8, 9, and 10 in the paper.
* `scripts/` - The scripts for reproducing the data and creating the figures 8, 9, and 10.
* `Dockerfile` - for creating the container with all the necessary dependencies needed for running the taint analysis and the run-time experiments (as described in Section 6.1 and Section 6.2 in the paper)


### Platform Requirements

Turnstile was evaluated on Ubuntu 20.04, on a virtual machine with 4 vCPUs and 8 GB RAM. The processor on the host machine was Intel Platinum 6548Y+.

We recommend that the machine has at least 10 GB of disk space available for the experiment data.

You can run the artifact on any machine using Docker, but the performance you observe might be slightly different than those in the paper due to platform differences.

---

### Getting Started

The quickest and recommended way to get started with running the artifact is to use the [pre-built Docker image](https://drive.google.com/file/d/161drqct_DJ88BEEwjgyp3gE8_VaNjpiF/view?usp=sharing), as it has the experiment environment already prepared with all the dependencies installed and workloads copied. The `Dockerfile` used to build the image can be found in this repository. The Docker image contains the following:

* The contents of this repository
* CodeQL (2.16.5)
* Node.js (18.19.1)
* Python 3 (3.10.0)
* 61 third-party Node-RED repositories used in the evaluation (Section 6) and their dependencies
* The experimental workload used in the run-time experiment described in Section 6.2

First, download the Docker image from [HERE](https://drive.google.com/file/d/161drqct_DJ88BEEwjgyp3gE8_VaNjpiF/view?usp=sharing).
Then, load the image as the following:

```
docker load -i turnstile-artifact.tar
```

Before starting a new container from the loaded image, you must first decide whether you want to mount any volume. This artifact *does not* require any volume to be mounted, but if you want to easily access any data produced inside the container, we suggest you mount a directory from your host machine to the container path `/root/output`. The experimental scripts are configured to save all data to `/root/output`.

Start a new container and enter the interactive shell:

```
docker run -it --name turnstile-exp turnstile:eurosys26 /bin/bash
```

(OPTIONAL) Or, start a new container with a mounted volume (assuming the directory on the host machine to be mounted is `/home/user/turnstile-output`):
```
docker run -it --name turnstile-exp --mount type=bind,source=/home/user/turnstile-output,target=/root/output turnstile:eurosys26 /bin/bash
```


### Reproducing the Experiments

Assuming that we are now in the container environment, this section will walk through the steps for reproducing the results from the paper.

#### Producing the Figures using the Original Data

First, as a sanity check, let us simply run the scripts for creating the figures, using the original data from the paper. Navigate to `/root/turnstile/scripts/presentation`:

```
# When the container starts, the CWD is /root
cd turnstile/scripts/presentation
```

The following are the scripts for producing the Figures 8, 9, and 10 respectively:
```
plot-line-dataflows.py
plot-area-applications.py
plot-bar-applications.py
```

To run any of the scripts, we must activate the Python virtual environment. Activate `venv`:
```
# CWD: /root/turnstile/scripts/presentation
source .venv/bin/activate
```

Then, run the `plot-*` scripts as the following:
```
python plot-line-dataflows.py /root/turnstile/data/analysis/dataflows-found.csv
python plot-area-applications.py /root/turnstile/data/experiment/plot-area-data.csv
python plot-bar-applications.py /root/turnstile/data/experiment/plot-bar-data.csv
```

The above scripts should produce Figures 8, 9, and 10 in the `/root/output` directory. The files will be named as below (`YYYYmmdd_HHMMSS` replaced with the appropriate timestamps):
```
line-plot.YYYYmmdd_HHMMSS.png
area-plot.YYYYmmdd_HHMMSS.png
bar-plot.YYYYmmdd_HHMMSS.png
```

If you have mounted a host directory, you should be able to see these images in the host machine. If not, you will need to `docker cp` the files into the host machine.
```
# From the host machine
docker cp turnstile-exp:/root/output/line-plot.YYYYmmdd_HHMMSS.png /path/on/my/machine/line-plot.png
```

You can compare the figures you produced with the original figures included in the repository to verify that the scripts ran successfully.


#### Running the Static Taint Analysis Experiment

We will now run the static taint analysis experiment described in Section 6.1 in the paper.
At a high-level, what we'll do is to run CodeQL and Turnstile's Dataflow Analyzer over the repositories located in `/root/target-repos`. There is one script to run the CodeQL analyzer, and another to run the Turnstile Dataflow Analyzer.

First, navigate to the `/root/turnstile/scripts/analysis` directory.
```
# CWD: /root/turnstile/scripts/presentation
cd ../analysis
```

First, let us run the **CodeQL analysis**:
```
# CWD: /root/turnstile/scripts/analysis
node run-codeql-multiple.js REPOLIST.txt
```

The `REPOLIST.txt` contains the list of target repositories to be analyzed. The `run-codeql-multiple.js` iterates through each entry, invoking a series of CodeQL commands to perform the analysis. You should see messages such as:
```
=====================================
Begin analyzing /root/target-repos/node-red-contrib-viseo/node-red-contrib-airtable
  ... creating codeql database at /root/codeql-db/node-red-contrib-viseo.node-red-contrib-airtable
  ... finished in 27.343 seconds
  ... analyzing codeql database at /root/codeql-db/node-red-contrib-viseo.node-red-contrib-airtable

```

**The CodeQL analysis can take up to 3 hours**, depending on your machine's hardware.

Once the analysis is finished, there will be a CSV file generated at `/root/output/codeql-taint-analysis-result.YYYY-mm-dd-HH-MM-SS.csv`.

Next, let us run the **Turnstile analysis**:
```
# CWD: /root/turnstile/scripts/analysis
node run-turnstile-multiple.js REPOLIST.txt
```

The process is similar -- the `run-turnstile-multiple.js` script iterates through the list of repositories and runs the static taint analysis. Each analysis will be invoked 10 times to obtain an average run-time. You should see messages such as:
```
/root/target-repos/node-red-contrib-viseo/node-red-contrib-airtable
1866ms, 1530ms, 2100ms,
```

**The Turnstile analysis can take up to 4 minutes**.

Once the analysis is finished, there will be a CSV file generated at `/root/output/turnstile-taint-analysis-result.YYYY-mm-dd-HH-MM-SS.csv`.


#### Plotting the Static Taint Analysis Result

Once we have the static taint analysis results from both CodeQL and Turnstile, we can process the results to produce the plot in Figure 8 in the paper.

Navigate to the `/root/turnstile/scripts/presentation` directory.
```
# CWD: /root/turnstile/scripts/analysis
cd ../presentation
```

First, let us "compile" the results:
```
# CWD: /root/turnstile/scripts/presentation
node compile-analysis-results.js \
    /root/output/turnstile-taint-analysis-result.YYYY-mm-dd-HH-MM-SS.csv \
    /root/output/codeql-taint-analysis-result.YYYY-mm-dd-HH-MM-SS.csv
```

This should produce a single compiled result at `/root/output/taint-analysis-compiled.YYYY-mm-dd-HH-MM-SS.csv`. We can now use the `plot-line-dataflows.py` script to generate the figure (we assume `venv` is still active).

```
# CWD: /root/turnstile/scripts/presentation
python plot-line-dataflows.py /root/output/taint-analysis-compiled.YYYY-mm-dd-HH-MM-SS.csv
```

The script should produce a PNG image at `/root/output/line-plot.YYYYmmdd_HHMMSS.png`.
You should verify that the figure is *exactly* the same as Figure 8.

This concludes the steps for reproducing the results in Section 6.1.


#### Running the Performance Overhead Experiment

We will now run the performance overhead experiment described in Section 6.2 in the paper.
At a high-level, we will be instantiating a target application in a test environment, feeding a series of input messages periodically, and measuring the time taken to process all the messages. Each "run" will involve one measurement with the unmanaged version of the application, and one measurement with Turnstile enabled.

First, navigate to the `/root/turnstile/scripts/experiment` directory.
```
# CWD: /root/turnstile/scripts/presentation
cd ../experiment
```

There is a single script `run-all-experiments.sh` that runs all the experiments automatically.
Simply run this script:
```
# CWD: /root/turnstile/scripts/experiment
./run-all-experiment.sh
```

You should see messages such as:
```
========================================
Starting Experiment 1: airtable
----------------------------------------


---[ Stage 1: Started ]---

/root/target-repos/node-red-contrib-viseo/node-red-contrib-airtable is a directory... trying to read as an NPM package
```

Let the experiment run -- **it can take up to 24 hours** and it will generate about 3.86 GB of data.

>[!NOTE]
> Please note that this is the "*compressed*" version of the experiment, which collects data more sparsely. The original experiment took about 38 hours. If you wish to reduce the experiment time more significantly, open the `run-all-experiments.sh` file and comment out the following lines. These two lines correspond to runs with input rate at 2 Hz, which is the most time consuming.
>
> ```
> # node run-experiment.js $exp_file V3-2fps false
> 
> # node run-experiment.js $exp_file V3-2fps true
> ```

Once the experiments have finished, there will be one or more directories in `/root/output` named `exp-YYYY-mm-dd`.
```
# For example:
exp-2025-09-01/
exp-2025-09-02/
```

The directory contains the raw measurements from each run, which need to be "compiled" for further processing.


#### Plotting the Performance Overhead Result

Navigate to the `/root/turnstile/scripts/presentation` directory.
```
# CWD: /root/turnstile/scripts/experiment
cd ../presentation
```

First, let us "compile" the results. We will assume there are two directories (`exp-2025-09-01` and `exp-2025-09-02`):
```
# CWD: /root/turnstile/scripts/presentation
node compile-experiment-results.js /root/output/exp-2025-09-01 /root/output/exp-2025-09-02
```

It should take a couple minutes to process the raw data and produce a single file at `/root/output/exp-results-compiled.YYYY-mm-dd-HH-MM-SS.json`. We cannot plot the data just yet -- we must further extract the data for two different plots in Figures 9 and 10.

Let us process the data for the plot in Figure 9, which shows the median of relative run-time over a range of input rates.
```
# CWD: /root/turnstile/scripts/presentation
node extract-area-data.js /root/output/exp-results-compiled.YYYY-mm-dd-HH-MM-SS.json
```

Let us do the same for the plot in Figure 10, which shows the relative run-time seen for each of the target applications at 30 Hz and 250 Hz.
```
# CWD: /root/turnstile/scripts/presentation
node extract-bar-data.js /root/output/exp-results-compiled.YYYY-mm-dd-HH-MM-SS.json
```

The above steps should produce two files at `/root/output`:
```
plot-area-data.YYYY-mm-dd-HH-MM-SS.csv
plot-bar-data.YYYY-mm-dd-HH-MM-SS.csv
```

We can now use the `plot-*` scripts to generate the figures:
```
python plot-area-applications.py plot-area-data.YYYY-mm-dd-HH-MM-SS.csv
python plot-bar-applications.py plot-bar-data.YYYY-mm-dd-HH-MM-SS.csv
```

Running the scripts above should produce two PNG images at `/root/output` named `area-plot.YYYYmmdd_HHMMSS.png` and `bar-plot.YYYYmmdd_HHMMSS.png` respectively.
You should verify that the overall trend in these figures are *similar* to those in Figures 9 and 10. These figures will be slightly different from those in the paper, as they depend on the run-time characteristics of the platform. The generated area plot also uses more sparse data, and might look "simpler" than the original Figure 9. However, the overall trend should still be the same -- the exhaustive instrumentation should incur significantly more overhead when the input rate is high.

This concludes the steps for reproducing the results in Section 6.2.


### (Optional) Running the Individual Scripts

In case you want to explore further, here we describe how to use the "micro-scripts" for running a single taint analysis or a single run-time experiment run. In practice, a researcher or a developer actively using Turnstile is more likely to use these scripts, rather than the automation scripts above.

**`scripts/analysis/run-codeql-single.js`** runs the CodeQL taint analysis on a single repository. You can use it as the following:
```
node run-codeql-single.js repository/root/path
```
Replace the `repository/root/path` with any of the entries in `REPOLIST.txt`. You can also provide an absolute path to any other third-party repository, if you wish to try the taint analysis on any other repository that was not covered in the paper.

**`scripts/analysis/run-turnstile-single.js`** runs the Turnstile taint analysis on a single repository. You can use it as the following:
```
node run-turnstile-single.js repository/root/path
```
Replace the `repository/root/path` with any of the entries in `REPOLIST.txt`. Same as the above, you can also provide an absolute path to any other third-party repository.

**`scripts/experiment/generate-workload.js`** generates a workload for a given experiment.
```
node generate-workload.js $exp_file $workload_size $label_count $input_interval $label_hierarchy $workload_name

# Example usage:
node generate-workload.js watson 1000 3 50 vertical V3-20fps
```
  * `$exp_file` is the name of the experiment, and should be one of the entries in `scripts/experiment/workloads/EXPERIMENT_LIST.txt`.
  * `$workload_size` is the total number of input messages.
  * `$label_count` is the number of label types. It is applicable only if the $label_hierarchy is "vertical" or "horizontal".
  * `$input_interval` is the interval between subsequent input messages, in milliseconds.
  * `$label_hierarchy` is the type of label hierarchy, and can be `vertical`, `horizontal`, or `tree.{D}.{B}`. The `tree.{D}.{B}` is used to generate a tree-based hiearchy where `{D}` is the depth (height) of the tree and `{B}` is the branching factor.
  * `$workload_name` is the name to assign to the generated workload. When running an experiment, we refer to the workload by this name.

**`scripts/experiment/run-experiment.js`** runs the performance experiment for a given application and workload.
```
node run-experiment.js $exp_file $workload_name $is_exhaustive

# Example usage:
node run-experiment.js watson V3-20fps true
```
  * `$exp_file` is the name of the experiment, and should be one of the entries in `scripts/experiment/workloads/EXPERIMENT_LIST.txt`.
  * `$workload_name` is the name of the workload to be used.
  * `$is_exhaustive` should be `true` or `false`, indicating whether to instrument all the code paths or not.


### (Optional) Building the Docker Image

In case you want to build the Docker image yourself, you can use the `Dockerfile`.
Assuming you have cloned this repository, simply run the following command in this repository's root:
```
docker build -t my-turnstile-image:1.0 .
```

The build might take 10 to 20 minutes, depending on your internet connection. Sometimes the build process can fail if your internet connection is not stable or fast enough, because it downloads a lot of data from Github and also installs a lot of dependencies using NPM.
If it fails repeatedly, try increasing the memory allocation for the Docker daemon.