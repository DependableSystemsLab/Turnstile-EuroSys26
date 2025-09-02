#!/bin/bash

set -e

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

. "${SCRIPT_DIR}/helpers.sh"

npm config set fetch-retries 5
npm config set fetch-retry-mintimeout 20000
npm config set fetch-timeout 300000

git clone https://github.com/mikejac/node-red-contrib-google-smarthome
cd node-red-contrib-google-smarthome
git checkout 7ab9725caaa4f5241e3206ba8822250ac6114ca8
retry 3 5 npm install
cd ..

git clone https://github.com/Foddy/node-red-contrib-huemagic
cd node-red-contrib-huemagic
git checkout f72d311c17faae940cd60928b800c0d6602df764
retry 3 5 npm install
cd ..

git clone https://github.com/BiancoRoyal/node-red-contrib-modbus
cd node-red-contrib-modbus
git checkout 0d042896b19dd2ef3075cbfabe9691cfe69bd6ce
retry 3 5 npm install
cd ..