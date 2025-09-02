Array.prototype.pickRandom = function(){
	return this[Math.floor(Math.random() * this.length)];
}

const xml2js = require('xml2js'),
	numberRE = /^-?([1-9]\d*|0)(\.\d*)?$/,
	dateRE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(.\d+)?Z$/,
	prefixMatch = /(?!xmlns)^.*:/;

/* Helper functions copied from onvif */
/**
 * Parse SOAP response
 * @param {string} xml
 * @param {ParseSOAPStringCallback} callback
 * @param {number} statusCode. This is passed in so it can be passed back out to the callback
 */
function parseSOAPString(xml, callback, statusCode) {
	/* Filter out xml name spaces */
	xml = xml.replace(/xmlns([^=]*?)=(".*?")/g, '');

	try {
		xml2js.parseString(
			xml, {
				tagNameProcessors: [function(str) {
					str = str.replace(prefixMatch, '');
					var secondLetter = str.charAt(1);
					if (secondLetter && secondLetter.toUpperCase() !== secondLetter) {
						return str.charAt(0).toLowerCase() + str.slice(1);
					} else {
						return str;
					}
				}]
			},
			function(err, result) {
				if (!result || !result['envelope'] || !result['envelope']['body']) {
					callback(new Error('Wrong ONVIF SOAP response'), null, xml, statusCode);
				} else {
					if (!err && result['envelope']['body'][0]['fault']) {
						var fault = result['envelope']['body'][0]['fault'][0];
						var reason;
						try {
							if (fault.reason[0].text[0]._) {
								reason = fault.reason[0].text[0]._;
							}
						} catch (e) {
							reason = '';
						}
						if (!reason) {
							try {
								reason = JSON.stringify(linerase(fault.code[0]));
							} catch (e) {
								reason = '';
							}
						}
						var detail = '';
						try {
							detail = fault.detail[0].text[0];
						} catch (e) {
							detail = '';
						}

						// console.error('Fault:', reason, detail);
						err = new Error('ONVIF SOAP Fault: ' + (reason) + (detail));
					}
					callback(err, result['envelope']['body'], xml, statusCode);
				}
			}
		);
	} catch (err) {
		callback(err, '', xml, statusCode);
	}
};
/* End of helper functions copied from onvif */

function createTestSinks(runtime, sink_labels, from_nodes){
	if (!from_nodes){
		from_nodes = Object.values(runtime.instances);
	}

	const sink_nodes = {};

	sink_labels.forEach(label => {
		const sink = runtime.createMockSink(label);

		from_nodes.forEach(node => {
			runtime.connectNodes(node, sink);
		});

		sink_nodes[label] = sink;
	});

	return sink_nodes;
}

module.exports = {
	parseSOAPString: parseSOAPString,
	createTestSinks: createTestSinks
}