require('dotenv').config();

const fs = require('fs');
const dgram = require('dgram');
const events = require('events');
const request = require('request');
const readline = require('readline');
const pidusage = require('pidusage');
const {spawn} = require('child_process');
const { execSync } = require('child_process');
const macaddress = require('macaddress');
const fastify = require('fastify')();
const kafka = require('kafka-node');

///////////// env /////////////

// API related config
const API_PORT = parseInt(process.env.API_PORT);

// Notifier related config
const ENABLE_NOTIFIER = JSON.parse(process.env.ENABLE_NOTIFIER);
const NOTIFIER_ENDPOINT = process.env.NOTIFIER_ENDPOINT;

// FFmpeg related config
const FFMPEG_INPUT = process.env.FFMPEG_INPUT;
const FFMPEG_OUTPUTS = process.env.FFMPEG_OUTPUTS.split(',');

// Test related config
const ENABLE_TEST = JSON.parse(process.env.ENABLE_TEST);

const TEST_FILE = process.env.TEST_FILE;
const TEST_INTERVAL = parseInt(process.env.TEST_INTERVAL);
const TEST_BITRATES = JSON.parse(process.env.TEST_BITRATES);

// Kafka related config
const ENABLE_KAFKA = JSON.parse(process.env.ENABLE_KAFKA);
const ENABLE_KAFKA_CONSUMER = JSON.parse(process.env.ENABLE_KAFKA_CONSUMER);
const ENABLE_KAFKA_PRODUCER = JSON.parse(process.env.ENABLE_KAFKA_PRODUCER);

const KAFKA_KEY = process.env.KAFKA_KEY;
// const KAFKA_ATTRIBUTE = process.env.KAFKA_ATTRIBUTE;
const KAFKA_HOST = process.env.KAFKA_HOST;
const KAFKA_PORT = process.env.KAFKA_PORT;
const KAFKA_CONSUMER_TOPIC=process.env.KAFKA_CONSUMER_TOPIC;
const KAFKA_PRODUCER_TOPIC=process.env.KAFKA_PRODUCER_TOPIC;

///////////// nmc /////////////

// spawn('node', ['nmc.js'], {
//   stdio: ['ignore']
// });

//////////// notifier ////////////

const notifyType = 'POST';
const notifyState = {
  bitrate: 'FF_BITRATE',
  start: 'FF_START',
  exit: 'FF_EXIT'
};

function notify(state) {
  if (!ENABLE_NOTIFIER) return;
  let key = null;
  let message = {};
  for(let i = 0; i<arguments.length; i++) {
    key = 'value' + (i + 1);
    message[key] = arguments[i];
  }
  request({
    url: NOTIFIER_ENDPOINT,
    method: notifyType,
    json: message || null
  });
}

///////////// ffmpeg /////////////

let ffmpeg = null;
let conf = {
  id: 'N/A',
  gop: 25,
  bitrate: 3000
};
let stats = {
  id: {
    name: 'Id',
    value: 'XXX'
  },
  utc_time: {
    name: 'UTC Time [ms]',
    value: 0
  },
  pid: {
    name: 'PID',
    value: 0
  },
  pid_cpu: {
    name: 'CPU Usage [%]',
    value: 0.0
  }, // in %
  pid_ram: {
    name: 'RAM Usage [byte]',
    value: 0
  }, // in byte
  gop_size: {
    name: 'GoP Size',
    value: 0
  },
  num_fps: {
    name: 'Fps',
    value: 0
  },
  num_frame: {
    name: 'Frame',
    value: 0
  },
  enc_quality: {
    name: 'Quality [0-69]',
    value: 0
  },
  enc_dbl_time: {
    name: 'Encoding Time [s]',
    value: 0.00
  }, // in s
  enc_str_time: {
    name: 'Encoding Time [h:m:s:ms]',
    value: '00:00:00.00'
  }, // in hh:mm:ss:ms
  max_bitrate: {
    name: 'Maximum Bitrate [kbps]',
    value: 0.0
  }, // in kbps
  avg_bitrate: {
    name: 'Average Bitrate [kbps]',
    value: 0.0
  }, // in kbps
  act_bitrate: {
    name: 'Actual Bitrate [kbps]',
    value: 0.0
  }, // in kbps
  enc_speed: {
    name: 'Encoding Speed [x]',
    value: 0
  } // in x
};

const statsEventEmitter = new events.EventEmitter();
// const STATS_LOG_FILE = 'vstats.log';
const args = [
  '-loglevel', 'quiet',
  '-stats',
//---- INPUT (default: NMC RTMP server)
//   '-vstats',
//   '-vstats_file', STATS_LOG_FILE,
//   '-i', 'rtmp://localhost/live/teststream',
//   '-i', 'tcp://[1050:2::2]:11000',
  '-i', FFMPEG_INPUT,
//---- VIDEO ENCODING
//   '-r', '25',
  '-c:v', 'libx264',
  '-crf', '10',
  '-preset', 'ultrafast',
  '-tune', 'zerolatency',
  // '-b:v', '3000k',
  '-maxrate', conf.bitrate + 'k',
  '-bufsize', (conf.bitrate / 2) + 'k',
  '-pix_fmt', 'yuv420p',
  '-g', conf.gop,
  '-intra-refresh', '1',
  // '-vf', 'drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf: fontsize=16: box=1: boxborderw=10: boxcolor=black@0.6: textfile=0.txt:reload=1: fontcolor=white@1.0: x=50: y=50',
//---- AUDIO ENCODING
  // '-c:a', 'copy',
  // '-an',
  '-c:a', 'libfdk_aac',
  // '-flags', '+global_header', // need to fix tee pseudo muxer (is not to be set in case of udp outputs only)
  '-ar', '44100',
//---- OUTPUT
  // '-f', 'flv',
  // '-f', 'mpegts',
  // 'udp://[1050:3::2]:5004' //Demonstrator
  // 'udp://[1050:3::4]:5004' //Speech-to-Text
  // 'udp://[1050:3::5]:5004' //Traffic manager
  '-f', 'tee',
  '-map', '0:v',
  '-map', '0:a',
  // '[f=flv]rtmp://localhost/live/stream|[f=mpegts]udp://[1050:3::2]:5004|[f=mpegts]udp://[1050:3::4]:5004'
  // '[f=mpegts]udp://[1050:3::2]:5004|[f=mpegts]udp://[1050:3::4]:5004'
  // '[f=mpegts]udp://[1050:3::4]:5004|[f=mpegts]udp://[1050:3::5]:5004'
  '[flush_packets=0:f=mpegts]udp://' + FFMPEG_OUTPUTS.join('?pkt_size=1316|[flush_packets=0:f=mpegts]udp://') + '?pkt_size=1316'
];
const opts = {stdio: ['inherit', 'pipe', 'pipe']};

function spawnFFmpeg() {
  console.log('ffmpeg is starting...');
  //notify(notifyState.start);
  ffmpeg = spawn('ffmpeg', args, opts)
    .once('close', () => {
      console.log('ffmpeg closes.');
      //notify(notifyState.exit);
      setTimeout(spawnFFmpeg,5000);
    });
  readline.createInterface(ffmpeg.stdio[2])
    .on('line', (text) => {
      handleStats(text);
    });
}

function handleStats(text) {
  console.log(text);
  const tmp = text.match(/(\d+:\d+:\d+\.\d+|\d+\.\d+|\d+)/g);
  if (tmp && tmp.length >= 8) { //usually 10 but with tee muxer enabled size=N/A and bitrate=N/A
    pidusage(ffmpeg.pid, (e, s) => {
      if (e) return console.log(e);
      stats.id.value = conf.id;
      stats.utc_time.value = Date.now();
      stats.pid.value = ffmpeg.pid;
      stats.pid_cpu.value = parseFloat(s.cpu.toFixed(1)); // in %
      stats.pid_ram.value = s.memory; // in byte
      stats.gop_size.value = conf.gop;
      stats.num_fps.value = parseInt(tmp[1]);
      stats.num_frame.value = parseInt(tmp[0]);
      stats.enc_quality.value = parseFloat(tmp[2]);
      stats.enc_dbl_time.value = parseFloat(tmp[3]); // in s
      stats.enc_str_time.value = tmp[7]; // in hh:mm:ss:ms
      stats.max_bitrate.value = conf.bitrate; // in kbps
      stats.avg_bitrate.value = parseFloat(tmp[5]); // in kbps
      stats.act_bitrate.value = parseFloat(tmp[4]); // in kbps
      stats.enc_speed.value = parseFloat(tmp[tmp.length - 1]); // in x
      statsEventEmitter.emit('stats', stats);
      // const txt = 'fps: ' + stats.fps + '\r\n' +
      //   'time: ' + stats.time + '\r\n' +
      //   'bitrate: ' + stats.bitrate + 'kbits/s';
      // fs.writeFile('1.txt', txt, (err) => {
      //   if (err) return console.log(err);
      //   else fs.rename('1.txt', '0.txt', (err) => {
      //     if (err) return console.log(err);
      //   });
      // });
    });
  }
}

///////////// API /////////////

fastify.get('/', (request, reply) => {
  reply.send({status: true, stats: stats});
});

fastify.post('/bitrate/:b', (request, reply) => {
  conf.bitrate = parseInt(request.params.b); // in kbps
  sendDgram(conf.bitrate);
  reply.send({status: true, bitrate: conf.bitrate});
});

fastify.post('/gop/:g', (request, reply) => {
  conf.gop = parseInt(request.params.g);
  ffmpeg.exit();
  reply.send({status: true, gop: conf.gop});
});

fastify.listen(API_PORT, '0.0.0.0', (err, address) => {
  if (err) throw err;
  fastify.log.info(`server listening on ${address}`)
});

///////////// dgram /////////////

const PORT = 32000;
const HOST = '127.0.0.1';

function sendDgram(value) {
  const client = dgram.createSocket('udp4');
  const bitrate = value * 1000;
  let buf = Buffer.allocUnsafe(4);
  console.log('Change bitrate to %d kbits/s', value);
  //notify(notifyState.bitrate, value);
  buf.writeInt32LE(bitrate);
  client.send(buf, 0, buf.length, PORT, HOST, (err) => {
    if (err) throw err;
    client.close();
  });
}

///////////// Kafka bus /////////////

function startKafka() {
  let client = new kafka.KafkaClient({
    kafkaHost: KAFKA_HOST + ':' + KAFKA_PORT
  });
  if (ENABLE_KAFKA_CONSUMER)
    startConsumer(client);
  if (ENABLE_KAFKA_PRODUCER)
    startProducer(client);
}

function startConsumer(client) {
  // const id = conf.id.join(' ');
  const payloads = [
    {
      topic: KAFKA_CONSUMER_TOPIC,
      partition: 0
    }
  ];
  const options = {
    autoCommit: true
  };
  let Consumer = kafka.Consumer;
  let consumer = new Consumer(client, payloads, options);
  consumer.on('error', (err) => {
    console.log(err);
  });
  consumer.on('message', (message) => {
    console.log(message);
    let param = JSON.parse(message['value']);
    if (!(param['action']&&param['action']['bitrate'])) return;
    // if (message['key'] === KAFKA_KEY && id.indexOf(param[KAFKA_ATTRIBUTE]) >= 0) {
    if (JSON.parse(message['key']) === KAFKA_KEY) {
      request.post('http://localhost:' + API_PORT + '/bitrate/' + param['action']['bitrate']);
    }
  });
}

function startProducer(client) {
  let Producer = kafka.Producer;
  let producer = new Producer(client);
  producer.on('error', (err) => {
    console.log(err);
  });
  statsEventEmitter.addListener('stats', (data) => {
    let msg = {};
    for (let key in data) {
      if (data.hasOwnProperty(key))
        msg[key] = data[key]['value'];
    }
    const payloads = [
      {
        topic: KAFKA_PRODUCER_TOPIC,
        messages: JSON.stringify(msg),
        partition: 0
      }
    ];
    producer.send(payloads, (err, data) => {
      console.log(data);
    });
  });
}

///////////// Testing /////////////

let index = 0;
let testInterval = null;

function startTest(data) {
  let header = [];
  for (let key in data) {
    if (data.hasOwnProperty(key))
      header.push(data[key]['name']);
  }
  fs.writeFile(TEST_FILE, header.join(';') + '\n', (err) => {
    if (err) return console.log(err);
    testInterval = setInterval(performTestStep, TEST_INTERVAL);
    statsEventEmitter.addListener('stats', writeTestFile);
  });
}

function stopTest() {
  clearInterval(testInterval);
  statsEventEmitter.removeListener('stats', writeTestFile);
}

function writeTestFile(data) {
  let log = [];
  for (let key in data) {
    if (data.hasOwnProperty(key))
      log.push(data[key]['value']);
  }
  fs.appendFile(TEST_FILE, log.join(';') + '\n', (err) => {
    if (err) return console.log(err);
  });
}

function performTestStep() {
  if (index >= (TEST_BITRATES.length - 1))
    return stopTest();
  index++;
  request.post('http://localhost:' + API_PORT + '/bitrate/' + TEST_BITRATES[index]);
}

///////////// Start /////////////

macaddress.all((err, all) => {
  if (!err) {
    let ids = [];
    for (let key in all) {
      if (all.hasOwnProperty(key))
        ids.push(all[key]['mac']);
    }
    ids.push((execSync('./dmidecode.sh | grep UUID | awk \'{print $2}\'')).toString().trim());
    conf.id = ids;
    console.log(JSON.stringify(ids));
  }
  spawnFFmpeg();
  if (ENABLE_TEST)
    startTest(stats);
  if (ENABLE_KAFKA)
    startKafka();
});
