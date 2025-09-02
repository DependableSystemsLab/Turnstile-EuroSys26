#!/bin/bash

set -e

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

. "${SCRIPT_DIR}/helpers.sh"

npm config set fetch-retries 5
npm config set fetch-retry-mintimeout 20000
npm config set fetch-timeout 300000

git clone https://github.com/rdmtc/node-red-contrib-sun-position
cd node-red-contrib-sun-position
git checkout 8c3149df217103d7945a85761c697815b418cb59
retry 3 5 npm install
cd ..

git clone https://github.com/rdmtc/node-red-contrib-ccu
cd node-red-contrib-ccu
git checkout e0d3cc522be0598884285d38d50c58647bcd48a2
retry 3 5 npm install
cd ..

git clone https://github.com/deconz-community/node-red-contrib-deconz
cd node-red-contrib-deconz
git checkout 56a7be2132e1f7fa9a644b4e59e28ef2b419eb1c
retry 3 5 npm install
cd ..