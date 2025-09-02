const path = require('path');
const crypto = require('crypto');
const child_process = require('child_process');
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
		command: `ffmpeg -i input.mp4 -vf scale=1280:-1 -c:v libx264 -preset veryslow -crf 24 ${labels.pickRandom()}.mp4`
	}
};

const policy = {
	labellers: {
		data: data => data.x,
		output: data => (() => data.stdout)
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
	package: 'node-red-contrib-viseo/node-red-contrib-ffmpeg',
	generateInput: generateInput,
	policy: policy,
	setup: () => {
		// needed for VISEO components
		process.env.CONFIG_PATH = path.resolve(__dirname, 'exp-ffmpeg.config.js');
		process.env.NODE_ENV = 'dev';
		process.env.FRAMEWORK_ROOT = path.resolve(__dirname, '../test-packages/node-red-contrib-viseo/node_modules/node-red-viseo-bot-manager');
	},
	scenario: async (runtime, workload) => {
		// runtime.setMockRemoteServer(mockServer);
		runtime.setMockExecutable('ffmpeg', (args) => {
			const output = args[args.length - 1][0];

			return {
				stdout: Buffer.from(output),
				stderr: ''
// 				stderr: `ffmpeg version N.N.N Copyright (c) 2000-2024 the FFmpeg developers
//   built with gcc N.N.N (GCC) N.N.N
//   configuration: --enable-gpl --enable-libx264
//   libavutil      56.N.N / 56.N.N
//   libavcodec     58.N.N / 58.N.N
//   libavformat    58.N.N / 58.N.N
//   libavdevice    58.N.N / 58.N.N
//   libavfilter     7.N.N /  7.N.N
//   libswscale      5.N.N /  5.N.N
//   libswresample   3.N.N /  3.N.N
//   libpostproc    55.N.N / 55.N.N
// Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'input.mp4':
//   Metadata:
//     major_brand     : isom
//     minor_version   : 512
//     compatible_brands: isomiso2avc1mp41
//     encoder         : Lavf58.N.N
//   Duration: 00:02:34.56, start: 0.000000, bitrate: 1234 kb/s
//     Stream #0:0(und): Video: h264 (High) (avc1 / 0x31637661), yuv420p, 1920x1080, 1034 kb/s, 30 fps, 30 tbr, 30 tbn, 60 tbc (default)
//     Metadata:
//       handler_name    : VideoHandler
//     Stream #0:1(und): Audio: aac (LC) (mp4a / 0x6134706D), 44100 Hz, stereo, fltp, 123 kb/s (default)
//     Metadata:
//       handler_name    : SoundHandler
// Stream mapping:
//   Stream #0:0 -> #0:0 (h264 (native) -> h264 (libx264))
//   Stream #0:1 -> #0:1 (aac (native) -> aac (native))
// Press [q] to stop, [?] for help
// [libx264 @ 0x555555a3e000] using veryslow preset
// [libx264 @ 0x555555a3e000] using cpu capabilities: MMX2 SSE2Fast SSSE3 SSE4.2
// [libx264 @ 0x555555a3e000] profile High, level 4.0, 4:2:0, 8-bit
// [libx264 @ 0x555555a3e000] 264 - core 157 r2935 545de2f - H.264/MPEG-4 AVC codec - Copyleft 2003-2024 - http://www.videolan.org/x264.html - options: cabac=1 ref=3 deblock=1:0:0 analyse=0x3:0x113 me=umh subme=10 psy=1 psy_rd=1.00:0.00 mixed_ref=1 me_range=24 chroma_me=1 trellis=2 8x8dct=1 cqm=0 deadzone=21,11 fast_pskip=0 chroma_qp_offset=-2 threads=6 lookahead_threads=1 sliced_threads=0 nr=0 decimate=1 interlaced=0 bluray_compat=0 constrained_intra=0 bframes=3 b_pyramid=2 b_adapt=2 b_bias=0 direct=3 weightb=1 open_gop=0 weightp=2 keyint=250 keyint_min=25 scenecut=40 intra_refresh=0 rc_lookahead=60 rc=crf mbtree=1 crf=24.0 qcomp=0.60 qpmin=0 qpmax=69 qpstep=4 ip_ratio=1.40 aq=1:1.00
// Output #0, mp4, to 'output.mp4':
//   Metadata:
//     major_brand     : isom
//     minor_version   : 512
//     compatible_brands: isomiso2avc1mp41
//     encoder         : Lavf58.N.N
//     Stream #0:0(und): Video: h264 (libx264) (avc1 / 0x31637661), yuv420p, 1280x720, q=-1--1, 30 fps, 30 tbr, 30 tbn, 30 tbc (default)
//     Metadata:
//       handler_name    : VideoHandler
//       encoder         : Lavc58.N.N libx264
//     Side data:
//       cpb: bitrate max/min/avg: 0/0/0 buffer size: 0 vbv_delay: N/A
//     Stream #0:1(und): Audio: aac (mp4a / 0x6134706D), 44100 Hz, stereo, fltp, 128 kb/s (default)
//     Metadata:
//       handler_name    : SoundHandler
//       encoder         : Lavc58.N.N aac
// frame=    1 fps=0.0 q=0.0 size=       0kB time=00:00:00.00 bitrate=N/A speed=   0x    
// frame=   52 fps=0.0 q=0.0 size=       0kB time=00:00:01.66 bitrate=   0.2kbits/s speed=3.3x    
// frame=  101 fps=100 q=24.0 size=     256kB time=00:00:03.36 bitrate= 624.2kbits/s speed=3.35x    
// frame=  158 fps=104 q=24.0 size=     512kB time=00:00:05.30 bitrate= 791.3kbits/s speed=3.48x    
// ...
// frame= 2310 fps=118 q=24.0 size=    8192kB time=00:01:17.00 bitrate= 871.5kbits/s speed=3.95x    
// frame= 2402 fps=118 q=24.0 size=    8448kB time=00:01:20.10 bitrate= 864.3kbits/s speed=3.95x    
// frame= 2518 fps=118 q=24.0 size=    8704kB time=00:01:23.82 bitrate= 850.5kbits/s speed=3.95x    
// ...
// frame= 4648 fps=118 q=24.0 Lsize=   15843kB time=00:02:34.50 bitrate= 840.2kbits/s speed=3.94x    
// video:14891kB audio:235kB subtitle:0kB other streams:0kB global headers:0kB muxing overhead: 4.752128%
// [libx264 @ 0x555555a3e000] frame I:11    Avg QP:20.69  size: 38085
// [libx264 @ 0x555555a3e000] frame P:1152  Avg QP:24.00  size:  9518
// [libx264 @ 0x555555a3e000] frame B:3485  Avg QP:27.68  size:  2177
// [libx264 @ 0x555555a3e000] consecutive B-frames:  2.8%  1.0%  2.6% 93.6%
// [libx264 @ 0x555555a3e000] mb I  I16..4: 29.3%  0.0% 70.7%
// [libx264 @ 0x555555a3e000] mb P  I16..4:  4.0%  0.0%  3.5%  P16..4: 38.1% 16.8%  6.4%  0.0%  0.0%    skip:31.2%
// [libx264 @ 0x555555a3e000] mb B  I16..4:  0.4%  0.0%  0.2%  B16..8: 12.4%  1.5%  0.2%  direct: 0.6%  skip:84.7%  L0:41.2% L1:52.6% BI: 6.2%
// [libx264 @ 0x555555a3e000] 8x8 transform intra:0.0% inter:56.4%
// [libx264 @ 0x555555a3e000] coded y,uvDC,uvAC intra: 41.2% 54.8% 8.3% inter: 4.5
// `
			}
		});
		
		runtime.applyNodeSettings('ffmpeg-command', {
			credentials: {}
		});

		const config = {
			cmd: 'command',
			cmdType: 'msg'
		};
		const instance = runtime.createInstance('ffmpeg-command', config);

		helpers.createTestSinks(runtime, workload.labels || POSSIBLE_IDS, [ instance ]);

		await runtime.delay(100);

		// let testMsg = generateInput();
		// instance.emit('input', testMsg);

		for (let message of workload.inputs){
			instance.emit('input', message);

			if (workload.interval){
				await runtime.delay(workload.interval);
			}
		}
	}
}