#!/bin/bash

set -e

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

. "${SCRIPT_DIR}/helpers.sh"

npm config set fetch-retries 5
npm config set fetch-retry-mintimeout 20000
npm config set fetch-timeout 300000

git clone https://github.com/hobbyquaker/node-red-contrib-lgtv
cd node-red-contrib-lgtv
git checkout 16583f19ea2aeccaa9a43599da25966a99d2aa79
retry 3 5 npm install
cd ..

git clone https://github.com/codmpm/node-red-contrib-loxone
cd node-red-contrib-loxone
git checkout f03e8c3d3944df55ace086010081e8f198784ce9
retry 3 5 npm install
cd ..

git clone https://github.com/bartbutenaers/node-red-contrib-onvif-nodes
cd node-red-contrib-onvif-nodes
git checkout d8d39c85c8cbc1adcbff1d8579e7f9ba893033e9
retry 3 5 npm install
cd ..

git clone https://github.com/bartbutenaers/node-red-contrib-ui-svg
cd node-red-contrib-ui-svg
git checkout f10f2a313a4156ddb773ddc804880731d409efee
retry 3 5 npm install
cd ..