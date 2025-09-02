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
		y: labels.pickRandom(),
		method: 'GetWeather',
		params: {
			city: 'Vancouver',
			dst: labels.pickRandom()
		}
	}
};

const policy = {
	labellers: {
		data: data => data.x,
		client: {
			invoke: (obj, args) => {
				return args[0].dst;
			}
		}
	},
	rules: [
		'A -> B',
		'B -> C'
	]
}

const EXAMPLE_SOAP_PAGE = `<definitions name="WeatherService"
    targetNamespace="http://www.example.org/weatherservice/"
    xmlns:tns="http://www.example.org/weatherservice/"
    xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"
    xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/">

  <message name="GetWeatherRequest">
    <part name="city" type="xsd:string"/>
  </message>

  <message name="GetWeatherResponse">
    <part name="temperature" type="xsd:string"/>
    <part name="humidity" type="xsd:string"/>
    <part name="condition" type="xsd:string"/>
  </message>

  <portType name="WeatherPortType">
    <operation name="GetWeather">
      <input message="tns:GetWeatherRequest"/>
      <output message="tns:GetWeatherResponse"/>
    </operation>
  </portType>

  <binding name="WeatherBinding" type="tns:WeatherPortType">
    <soap:binding style="rpc" transport="http://schemas.xmlsoap.org/soap/http"/>
    <operation name="GetWeather">
      <soap:operation soapAction="GetWeather"/>
      <input>
        <soap:body use="literal"/>
      </input>
      <output>
        <soap:body use="literal"/>
      </output>
    </operation>
  </binding>

  <service name="WeatherService">
    <port name="WeatherPort" binding="tns:WeatherBinding">
      <soap:address location="http://www.example.org/weatherservice/WeatherService"/>
    </port>
  </service>

</definitions>`

const EXAMPLE_SOAP_RESPONSE = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wea="http://www.example.org/weatherservice/">
   <soapenv:Header/>
   <soapenv:Body>
      <wea:GetWeatherResponse>
         <wea:temperature>22°C</wea:temperature>
         <wea:humidity>65%</wea:humidity>
         <wea:condition>Sunny</wea:condition>
      </wea:GetWeatherResponse>
   </soapenv:Body>
</soapenv:Envelope>`

const mockServer = (req, res) => {
	if (req.uri.path === '/login'){
		res.status(200).json({
			token: crypto.randomBytes(10).toString('hex')
		});
	}
	else if (req.uri.pathname.split('/').slice(-1)[0] === 'soap'){
		res.status(200).send(EXAMPLE_SOAP_PAGE);
	}
	else if (req.uri.pathname.split('/').slice(-1)[0] === 'WeatherService'){
		res.status(200).send(EXAMPLE_SOAP_RESPONSE);
	}
	else  {
		res.status(200).json({
			token: crypto.randomBytes(10).toString('hex')
		});
	}
}

module.exports = {
	package: 'node-red-contrib-viseo/node-red-contrib-soap',
	generateInput: generateInput,
	policy: policy,
	setup: () => {
		// needed for VISEO components
		process.env.CONFIG_PATH = path.resolve(__dirname, 'exp-soap.config.js');
		process.env.NODE_ENV = 'dev';
		process.env.FRAMEWORK_ROOT = path.resolve(__dirname, '../test-packages/node-red-contrib-viseo/node_modules/node-red-viseo-bot-manager');
	},
	scenario: async (runtime, workload) => {
		runtime.setMockRemoteServer(mockServer);
		
		runtime.applyNodeSettings('soap-config', {
			credentials: {
				wsdl: 'https://test-wsdl.org/soap',
	            login: 'test-login',
	            password: 'test-password',
	            sslKey: 'test-sslKey',
	            sslCert: 'test-sslCert',
	            bearerToken: 'test-bearerToken'
			}
		});

		const config1 = {
			name: 'test-soap-name',
			auth: 'basic',
			options: {}
		};
		const instance1 = runtime.createInstance('soap-config', config1);

		const config2 = {
			client: instance1.id,
			method: 'method',
			methodType: 'msg',
			parameters: 'params',
			parametersType: 'msg'
		};
		const instance2 = runtime.createInstance('soap-request', config2);

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
		}
	}
}