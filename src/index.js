const http = require('http');
const express = require('express');
const axios = require('axios');
const txDecoder = require('ethereum-tx-decoder');
const web3 = require('web3');

var argv = require('yargs')
    .option('upstream', {
        alias: 'u',
        describe: 'HTTP URI for Ethereum node to which this service should proxy requests',
        demandOption: true,
        type: 'string'
    })
    .option('host', {
        describe: 'local ip of the interface to listen for RPC requests',
        default: '0.0.0.0',
        type: 'string'
    })
    .option('port', {
        describe: 'override the port on which the proxy should listen',
        default: '8545',
        type: 'string'
    })
    .option('txErrorRate', {
        describe: 'randomly simulate a percentage of transactions being dropped',
        default: 0.0,
        type: 'number'
    })
    .option('minGas', {
        describe: 'simulate dropping transactions under this gas price (GWEI)',
        default: 0.0,
        type: 'number'
    })
    .option('delay', {
        describe: 'add this latency (milliseconds) to each request',
        default: 0,
        type: 'number'
    })
    .option('rpcErrorRate', {
        describe: 'randomly return an error for a percentage of RPC requests',
        default: 0.0,
        type: 'number'
    })
    .argv
;

// validate commandline arguments
console.assert(argv.txErrorRate >= 0 && argv.txErrorRate < 1, "Please specify txErrorRate between 0.0 and 1.0")
console.assert(argv.minGas >= 0, "Please specify minGas greater than 0")
console.assert(argv.delay >= 0, "Cannot simulate shorter-than-normal latencies")
console.assert(argv.rpcErrorRate >= 0 && argv.rpcErrorRate < 1, "Please specify rpcErrorRate between 0.0 and 1.0")

const app = express();

axios.defaults.headers.post['Content-Type'] = 'application/json';

const config = {
  server: {
    host: argv.host,
    port: argv.port
  },
  upstream: argv.upstream
}

app.use((req, res, next) => {
  req.setEncoding('utf8');
  req.rpc = '';
  req.on('data', chunk => req.rpc += chunk);
  req.on('end', () => next());
});

http.createServer(app).listen(config.server.port, config.server.host);
console.log("Waiting for connections on " + config.server.host + ":" + config.server.port)

app.post('/', function (request, response, next)
{
  let rpc;

  console.log(request.rpc)

  try {
    rpc = JSON.parse(request.rpc);
  } catch(e) {
    return response.status(500).send({
      code: -32700,
      message: 'Parse error'
    });
  }

  if(rpc.method==='eth_sendRawTransaction') {
    const decodedData =  txDecoder.decodeTx(rpc.params[0]);
    console.log(decodedData);
    console.log('expected tx hash: '+ web3.utils.keccak256(rpc.params[0]) );
  }

  axios.post(config.upstream, request.rpc).then((res) => {
    let responseData = res.data;
    response.status(res.status).send(responseData);
  }).catch(e => {
    // no hook on errors
    console.log(e)
    response.status(e.response.status).send(
      //hookResponseData(request.rpc.method, e.response.data)
      e.response.data
    );
  });
});



app.use(function(req, res, next) {
  return res.status(404).send({
    code: -32601,
    message: "Not found"
  });
});
