// Note for this experiment:
// - In onvif_discovery.js line 22, the discovery "cooldown" period
//   is defined as 5000 ms by default. Remove the multiplication by 1000
//   to make the cooldown period much shorter (in the ms range)
//   Otherwise, the experiment takes too long as we need to wait for the
//   cooldown period for each message. (All inputs are ignored during the
//   cooldown period, so no experimental input will be processed)

const path = require('path');
const crypto = require('crypto');
const helpers = require('./helpers.js');

const POSSIBLE_IDS = [
	'A',
	'B',
	'C'
];

const generateInput = (labels = POSSIBLE_IDS) => {
	return {
		x: labels.pickRandom(),
		y: labels.pickRandom()
	}
};

const policy = {
	labellers: {
		node: node => node.config.table,
		data: data => data.x
	},
	rules: [
		'A -> B',
		'B -> C'
	]
}

const mockServer = (req, res) => {
	if (req.uri.path === '/login'){
		res.status(200).json({
			token: crypto.randomBytes(10).toString('hex')
		});
	}
	else if (req.uri.path.split('/').slice(-1)[0] === 'command'){
		res.status(200).json([ 'move', 'spin', 'shake' ]);
	}
}

module.exports = {
	package: 'node-red-contrib-onvif-nodes',
	generateInput: generateInput,
	policy: policy,
	scenario: async (runtime, workload) => {
		runtime.setMockRemoteServer(mockServer);

		const udpServer = runtime.createMockUdpSocket();
		udpServer.on('message', (message, client) => {
			let request = message.toString('utf8');
			request = helpers.parseSOAPString(request, function(err, data, xml, _statusCode){
				client.emit('message', `<Envelope xmlns="http://www.w3.org/2003/05/soap-envelope"
                  xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing"
                  xmlns:wsd="http://schemas.xmlsoap.org/ws/2005/04/discovery"
                  xmlns:dn="http://www.onvif.org/ver10/network/wsdl">
    <Header>
        <wsa:MessageID>uuid:fe70c0c3-99e1-45e3-b194-6d0738b92fcf</wsa:MessageID>
        <wsa:RelatesTo>uuid:e0b9f793-7dec-453c-8a3a-15d60754b6d0</wsa:RelatesTo>
        <wsa:To>http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous</wsa:To>
        <wsa:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/ProbeMatches</wsa:Action>
    </Header>
    <Body>
        <wsd:ProbeMatches>
            <wsd:ProbeMatch>
                <wsa:EndpointReference>
                    <wsa:Address>urn:uuid:abcd1234-5678-90ab-cdef-1234567890ab</wsa:Address>
                </wsa:EndpointReference>
                <wsd:Types>dn:NetworkVideoTransmitter</wsd:Types>
                <wsd:Scopes>
                    http://www.onvif.org/type/NetworkVideoTransmitter
                    http://www.onvif.org/hardware/ExampleCamera
                    http://www.onvif.org/name/ExampleCamera
                </wsd:Scopes>
                <wsd:XAddrs>http://192.168.1.100/onvif/device_service</wsd:XAddrs>
                <wsd:MetadataVersion>1</wsd:MetadataVersion>
            </wsd:ProbeMatch>
        </wsd:ProbeMatches>
    </Body>
</Envelope>
`, { address: '192.168.1.100', port: 12123 });
			}, 200);
		});
		
		runtime.applyNodeSettings('onvif-config', {
			credentials: {
				user: 'test-user',
				password: 'test-password'
			}
		});

		const config1 = {
			xaddress: 'test-onvif.org',
            port: 80,
            timeout: 30,
            checkConnectionInterval: 5,
            name: 'onvif-config'
		};
		const instance1 = runtime.createInstance('onvif-config', config1);

		const config2 = {
			name: 'onvif-discovery',
            timeout: 1,
            separate: true
		};
		const instance2 = runtime.createInstance('onvif-discovery', config2);

		helpers.createTestSinks(runtime, workload.labels || POSSIBLE_IDS, [ instance2 ]);

		await runtime.delay(100);

		// Object.values(runtime.instances).forEach(instance => {
		// 	let testMsg = generateInput();
		// 	instance.emit('input', testMsg);
		// });

		for (let message of workload.inputs){
			instance2.emit('input', message);

			if (workload.interval){
				await runtime.delay(workload.interval);
			}
			else {
				await runtime.delay(1);	// yield to let the udp socket perform async operations
			}
		}

		await runtime.delay(500);

		runtime.closeAllSockets();
	}
}