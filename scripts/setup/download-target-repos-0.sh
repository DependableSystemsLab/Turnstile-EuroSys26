#!/bin/bash

set -e

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

. "${SCRIPT_DIR}/helpers.sh"

npm config set fetch-retries 5
npm config set fetch-retry-mintimeout 20000
npm config set fetch-timeout 300000

git clone https://github.com/datech/node-red-contrib-amazon-echo.git
cd node-red-contrib-amazon-echo
git checkout 4a02ad1e00747dde39c8c29af9cf4dca97b097d9
retry 3 5 npm install
cd ..

git clone https://github.com/watson-developer-cloud/node-red-node-watson
cd node-red-node-watson
git checkout dc29f8dd09bdbfd669c5560ed0e0b8eccb4e149f
retry 3 5 npm install
cd ..

git clone https://github.com/NGRP/node-red-contrib-viseo
cd node-red-contrib-viseo
git checkout fb67a69059ea53de15dbc99e836d988905bb58d6
echo "{}" > package.json
retry 3 5 npm install request@2.88.2 request-promise@4.2.6 cookie-parser@1.4.6 node-red-viseo-bot-manager@0.2.0 node-red-viseo-helper@0.4.1 node-red-contrib-viseo-google-authentication@0.1.1 node-red-contrib-viseo-nosql-manager@0.1.0
cd ..