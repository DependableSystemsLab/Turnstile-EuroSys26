#!/bin/bash

set -e

PATCH_ROOT=$TURNSTILE_ROOT/scripts/setup/patches

cp $PATCH_ROOT/node-airtable.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-viseo/node-red-contrib-airtable/node-airtable.js
cp $PATCH_ROOT/amazon-echo-index.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-amazon-echo/index.js
cp $PATCH_ROOT/node-aws-lex.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-viseo/node-red-contrib-aws/node-aws-lex.js
cp $PATCH_ROOT/node-aws-rekognition.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-viseo/node-red-contrib-aws/node-aws-rekognition.js
cp $PATCH_ROOT/node-blink.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-viseo/node-red-contrib-blink/node-blink.js
cp $PATCH_ROOT/ccu-package.json $ANALYSIS_TARGETS_ROOT/node-red-contrib-ccu/package.json
cp $PATCH_ROOT/node-dialogflow.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-viseo/node-red-contrib-dialogflow/node-dialogflow.js
cp $PATCH_ROOT/node-dialogflow-handoff.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-viseo/node-red-contrib-dialogflow/node-dialogflow-handoff.js
cp $PATCH_ROOT/node-ffmpeg-command.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-viseo/node-red-contrib-ffmpeg/node-ffmpeg-command.js
cp $PATCH_ROOT/node-file-xlsx.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-viseo/node-red-contrib-file/node-file-xlsx.js
cp $PATCH_ROOT/node-get-lines.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-viseo/node-red-contrib-file/node-get-lines.js
cp $PATCH_ROOT/node-log-line.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-viseo/node-red-contrib-file/node-log-line.js
cp $PATCH_ROOT/node-file-operation.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-viseo/node-red-contrib-file-operation/node-file-operation.js
cp $PATCH_ROOT/google-actions.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-viseo/node-red-contrib-google-actions/google-actions.js
cp $PATCH_ROOT/order-update.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-viseo/node-red-contrib-google-actions/order-update.js
cp $PATCH_ROOT/google-places.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-viseo/node-red-contrib-google-maps/google-places.js
cp $PATCH_ROOT/node-help.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-viseo/node-red-contrib-help/node-nodes.js
cp $PATCH_ROOT/iadvize-query.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-viseo/node-red-contrib-iadvize/iadvize-query.js
cp $PATCH_ROOT/node-inbenta-request.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-viseo/node-red-contrib-inbenta/node-inbenta-request.js
cp $PATCH_ROOT/node-jimp.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-viseo/node-red-contrib-jimp/node-jimp.js
cp $PATCH_ROOT/lgtv-app.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-lgtv/nodes/lgtv-app.js
cp $PATCH_ROOT/lgtv-channel.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-lgtv/nodes/lgtv-channel.js
cp $PATCH_ROOT/lgtv-config.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-lgtv/nodes/lgtv-config.js
cp $PATCH_ROOT/lgtv-mute.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-lgtv/nodes/lgtv-mute.js
cp $PATCH_ROOT/lgtv-volume.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-lgtv/nodes/lgtv-volume.js
cp $PATCH_ROOT/lgtv-package.json $ANALYSIS_TARGETS_ROOT/node-red-contrib-lgtv/package.json
cp $PATCH_ROOT/modbus-flex-connector.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-modbus/src/modbus-flex-connector.js
cp $PATCH_ROOT/modbus-flex-server.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-modbus/src/modbus-flex-server.js
cp $PATCH_ROOT/modbus-queue-info.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-modbus/src/modbus-queue-info.js
cp $PATCH_ROOT/modbus-response-filter.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-modbus/src/modbus-response-filter.js
cp $PATCH_ROOT/modbus-server.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-modbus/src/modbus-server.js
cp $PATCH_ROOT/modbus-package.json $ANALYSIS_TARGETS_ROOT/node-red-contrib-modbus/package.json
cp $PATCH_ROOT/node-ms-graph-excel.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-viseo/node-red-contrib-ms-graph/node-ms-graph-excel.js
cp $PATCH_ROOT/node-ms-graph.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-viseo/node-red-contrib-ms-graph/node-ms-graph.js
cp $PATCH_ROOT/node-luis.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-viseo/node-red-contrib-ms-language/node-luis.js
cp $PATCH_ROOT/node-qna.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-viseo/node-red-contrib-ms-language/node-qna.js
cp $PATCH_ROOT/node-text-analytics.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-viseo/node-red-contrib-ms-language/node-text-analytics.js
cp $PATCH_ROOT/node-search.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-viseo/node-red-contrib-ms-search/node-search.js
cp $PATCH_ROOT/node-spell-check.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-viseo/node-red-contrib-ms-search/node-spell-check.js
cp $PATCH_ROOT/node-speech-api.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-viseo/node-red-contrib-ms-speech/node-speech-api.js
cp $PATCH_ROOT/node-video-indexer.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-viseo/node-red-contrib-ms-vision/node-video-indexer.js
cp $PATCH_ROOT/node-vision-image-describe.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-viseo/node-red-contrib-ms-vision/node-vision-image-describe.js
cp $PATCH_ROOT/node-vision-image-faces.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-viseo/node-red-contrib-ms-vision/node-vision-image-faces.js
cp $PATCH_ROOT/node-nlp-js.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-viseo/node-red-contrib-nlp-js/node-nlp-js.js
cp $PATCH_ROOT/onvif_discovery.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-onvif-nodes/onvif_discovery.js
cp $PATCH_ROOT/node-soap-request.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-viseo/node-red-contrib-soap/node-soap-request.js
cp $PATCH_ROOT/node-sox-command.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-viseo/node-red-contrib-sox/node-sox-command.js
cp $PATCH_ROOT/sun-position-package.json $ANALYSIS_TARGETS_ROOT/node-red-contrib-sun-position/package.json
cp $PATCH_ROOT/node-trello-card.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-viseo/node-red-contrib-trello/node-trello-card.js
cp $PATCH_ROOT/node-trello-in.js $ANALYSIS_TARGETS_ROOT/node-red-contrib-viseo/node-red-contrib-trello/node-trello-in.js
cp $PATCH_ROOT/v1-workspace-manager.js $ANALYSIS_TARGETS_ROOT/node-red-node-watson/services/assistant/v1-workspace-manager.js
cp $PATCH_ROOT/v1-document-loader.js $ANALYSIS_TARGETS_ROOT/node-red-node-watson/services/discovery/v1-document-loader.js
cp $PATCH_ROOT/v1-query-builder.js $ANALYSIS_TARGETS_ROOT/node-red-node-watson/services/discovery/v1-query-builder.js
cp $PATCH_ROOT/watson-language-translator.js $ANALYSIS_TARGETS_ROOT/node-red-node-watson/services/language_translator/v3.js
cp $PATCH_ROOT/watson-payload-utils.js $ANALYSIS_TARGETS_ROOT/node-red-node-watson/utilities/payload-utils.js