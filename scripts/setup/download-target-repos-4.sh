#!/bin/bash

set -e

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

. "${SCRIPT_DIR}/helpers.sh"

cd node-red-contrib-viseo/node-red-contrib-airtable
retry 3 5 npm install airtable@0.7.1
cd ../..

cd node-red-contrib-viseo/node-red-contrib-aws
retry 3 5 npm install aws-sdk@2.284.1
cd ../..

cd node-red-contrib-viseo/node-red-contrib-chatbase
retry 3 5 npm install moment@2.30.1
cd ../..

cd node-red-contrib-viseo/node-red-contrib-dialogflow
retry 3 5 npm install actions-on-google@2.12.0
cd ../..

cd node-red-contrib-viseo/node-red-contrib-directline
retry 3 5 npm install formidable@1.2.6 ws@8.16.0
cd ../..

cd node-red-contrib-viseo/node-red-contrib-ethjs
retry 3 5 npm install ethjs-account@0.1.4 ethjs-provider-signer@0.1.4 ethjs-signer@0.1.1 ethjs@0.2.9
cd ../..

cd node-red-contrib-viseo/node-red-contrib-ffmpeg
retry 3 5 npm install is-utf8@0.2.1
cd ../..

cd node-red-contrib-viseo/node-red-contrib-file
retry 3 5 npm install xlsx@0.8.8 readline-promise@0.0.1
cd ../..

cd node-red-contrib-viseo/node-red-contrib-google-actions
retry 3 5 npm install actions-on-google@2.12.0
cd ../..

cd node-red-contrib-viseo/node-red-contrib-google-authentication
retry 3 5 npm install googleapis@44.0.0
cd ../..

cd node-red-contrib-viseo/node-red-contrib-google-maps
retry 3 5 npm install @google/maps@0.4.6
cd ../..

cd node-red-contrib-viseo/node-red-contrib-google-speech
retry 3 5 npm install @google-cloud/speech@3.3.2 @google-cloud/text-to-speech@1.4.1
cd ../..

cd node-red-contrib-viseo/node-red-contrib-google-youtube
retry 3 5 npm install googleapis@44.0.0
cd ../..

cd node-red-contrib-viseo/node-red-contrib-iadvize
retry 3 5 npm install crypto-js@3.1.8 uuid@3.1.0
cd ../..

cd node-red-contrib-viseo/node-red-contrib-jimp
retry 3 5 npm install jimp@0.5.6
cd ../..

cd node-red-contrib-viseo/node-red-contrib-mongodb
retry 3 5 npm install mongodb@3.7.4
cd ../..

cd node-red-contrib-viseo/node-red-contrib-ms-language
retry 3 5 npm install html-entities@1.4.0
cd ../..

cd node-red-contrib-viseo/node-red-contrib-mustache
retry 3 5 npm install mustache@3.0.3
cd ../..

cd node-red-contrib-viseo/node-red-contrib-nedb
retry 3 5 npm install nedb@1.8.0 node-xlsx@0.7.4
cd ../..

cd node-red-contrib-viseo/node-red-contrib-nlp-js
retry 3 5 npm install node-nlp@2.2.4
cd ../..

cd node-red-contrib-viseo/node-red-contrib-qrcode
retry 3 5 npm install jsqr@0.2.2 jimp@0.2.28 query-string@5.1.1
cd ../..

cd node-red-contrib-viseo/node-red-contrib-recast
retry 3 5 npm install recastai@3.6.0
cd ../..

cd node-red-contrib-viseo/node-red-contrib-salesforce
retry 3 5 npm install jsonwebtoken@8.5.1
cd ../..

cd node-red-contrib-viseo/node-red-contrib-sarah
retry 3 5 npm install tree-kill@1.2.2
cd ../..

cd node-red-contrib-viseo/node-red-contrib-soap
retry 3 5 npm install soap@0.27.1
cd ../..

cd node-red-contrib-viseo/node-red-contrib-sox
retry 3 5 npm install is-utf8@0.2.1
cd ../..

cd node-red-contrib-viseo/node-red-contrib-socketio
retry 3 5 npm install socket.io@2.1.1
cd ../..

cd node-red-contrib-viseo/node-red-contrib-tokenizer
retry 3 5 npm install crypto-js@3.3.0
cd ../..

cd node-red-contrib-viseo/node-red-contrib-wechat
retry 3 5 npm install wechat-api@1.35.1 wechat@2.1.0
cd ../..

cd node-red-contrib-viseo/node-red-contrib-zendesk
retry 3 5 npm install ws@7.5.9
cd ../..
