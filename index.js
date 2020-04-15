require('dotenv').config();

const devnull = require('dev-null');
const readline = require('readline');
const {spawn} = require('child_process');
const fastify = require('fastify')({
  logger: true
});

///////////// Vars ////////////
const API_PORT = 3000;

// Receive the stream via VLC, ffplay -> udp://[1050:3::4]:5004
const FFMPEG_INPUT = process.env.FFMPEG_INPUT || 'tcp://[1050:2::2]:11000';
const FFMPEG_OUTPUT = process.env.FFMPEG_OUTPUT || '[1050:3::4]:5004';

// see https://ffmpeg.org/ffmpeg-utils.html#video-size-syntax
const FFMPEG_RESOLUTION_LOW = process.env.FFMPEG_RESOLUTION_LOW || 'hd720';
const FFMPEG_RESOLUTION_HIGH = process.env.FFMPEG_RESOLUTION_HIGH || 'hd1080';

///////////// ffmpeg /////////////

console.log('ffmpeg is starting...');

const args1 = [
  '-loglevel', 'quiet',
//---- INPUT
  '-i', FFMPEG_INPUT,
//---- LOW RESOLUTION
  '-map', '0',
  '-c:v', 'libx264',
  '-preset', 'ultrafast',
  '-tune', 'zerolatency',
  '-maxrate', '5000k',
  '-bufsize', '2500k',
  '-pix_fmt', 'yuv420p',
  '-g', '25',
  '-vf', 'scale=eval=frame:size=' + FFMPEG_RESOLUTION_LOW,
  '-c:a', 'aac',
  '-strict', '-2',
  '-ar', '44100',
  '-f', 'mpegts',
  'pipe:1',
//---- HIGH RESOLUTION
  '-map', '0',
  '-c:v', 'libx264',
  '-preset', 'ultrafast',
  '-tune', 'zerolatency',
  '-maxrate', '5000k',
  '-bufsize', '2500k',
  '-pix_fmt', 'yuv420p',
  '-g', '25',
  '-vf', 'scale=eval=frame:size=' + FFMPEG_RESOLUTION_HIGH,
  '-c:a', 'aac',
  '-strict', '-2',
  '-ar', '44100',
  '-f', 'mpegts',
  'pipe:3'
];
const args2 = [
  '-loglevel', 'quiet',
  '-stats',
  '-i', 'pipe:0',
  '-c', 'copy',
  '-flush_packets', '0',
  '-f', 'mpegts',
//---- OUTPUT
  'udp://' + FFMPEG_OUTPUT + '?pkt_size=1316'
];
const opts1 = {stdio: ['inherit', 'pipe', 'inherit', 'pipe']};
const opts2 = {stdio: ['pipe', 'inherit', 'pipe']};

let ffmpeg1 = null;
let ffmpeg2 = null;
let inStream = null;
let dummyStream = null;
let outHighResolution = null;
let outLowResolution = null;
let stats = {
  profile: FFMPEG_RESOLUTION_HIGH,
  frame: 0,
  fps:0,
  q:0,
  size: 0,
  time: '00:00:00.00',
  bitrate: '0kbits/s',
  speed: '0x'
};

function spawnFFmpeg1() {
  ffmpeg1 = spawn('ffmpeg', args1, opts1)
    .once('close', () => {
      console.log('ffmpeg1 closes.');
      spawnFFmpeg1();
    });
  dummyStream = devnull();
  outLowResolution = ffmpeg1.stdio[1];
  outHighResolution = ffmpeg1.stdio[3];
}

function spawnFFmpeg2() {
  ffmpeg2 = spawn('ffmpeg', args2, opts2)
    .once('close', () => {
      console.log('ffmpeg2 closes.');
      spawnFFmpeg2();
      setHighResolution();
    });
  readline.createInterface(ffmpeg2.stdio[2])
    .on('line', (text) => {
      handleStats(text);
    });
  inStream = ffmpeg2.stdio[0];
}

function handleStats(text) {
  console.log(text);
  const tmp = text.match(/(\d+:\d+:\d+\.\d+|\d+\.\d+|\d+)/g);
  if (tmp && tmp.length === 7) {
    stats.frame = tmp[0];
    stats.fps = tmp[1];
    stats.q = tmp[2];
    stats.size = tmp[3];
    stats.time = tmp[4];
    stats.bitrate = tmp[5] + 'kbits/s';
    stats.speed = tmp[6] + 'x';
  }
}

function unsetHighResolution() {
  outHighResolution.unpipe(inStream);
  outLowResolution.unpipe(dummyStream);
}
function unsetLowResolution() {
  outHighResolution.unpipe(dummyStream);
  outLowResolution.unpipe(inStream);
}
function setHighResolution() {
  outHighResolution.pipe(inStream);
  outLowResolution.pipe(dummyStream);
  stats.profile = FFMPEG_RESOLUTION_HIGH;
}
function setLowResolution() {
  outHighResolution.pipe(dummyStream);
  outLowResolution.pipe(inStream);
  stats.profile = FFMPEG_RESOLUTION_LOW;
}

function initialize() {
  spawnFFmpeg1();
  spawnFFmpeg2();
  setHighResolution();
}

// Start ffmpeg and configure initial output resolution
initialize();

///////////// API /////////////

fastify.get('/', (request, reply) => {
  reply.send({status: true, stats: stats});
});

fastify.post('/resolution/low', (request, reply) => {
  if (stats.profile === FFMPEG_RESOLUTION_HIGH) {
    unsetHighResolution();
    setLowResolution();
    reply.send({status: true, profile: stats.profile});
  }
  else {
    reply.send({status: false, error: 'Profile already set to: ' + stats.profile});
  }
});

fastify.post('/resolution/high', (request, reply) => {
  if (stats.profile === FFMPEG_RESOLUTION_LOW) {
    unsetLowResolution();
    setHighResolution();
    reply.send({status: true, profile: stats.profile});
  }
  else {
    reply.send({status: false, error: 'Profile already set to: ' + stats.profile});
  }
});

fastify.listen(API_PORT, '0.0.0.0', (err, address) => {
  if (err) throw err;
  fastify.log.info(`server listening on ${address}`)
});
