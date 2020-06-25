const http = require('http');
const express = require('express');
const axios = require('axios');
const txDecoder = require('ethereum-tx-decoder');
const web3 = require('web3');

const app = express();

axios.defaults.headers.post['Content-Type'] = 'application/json';

const config = {
  server: {
    host: '0.0.0.0',
    port: '8545'
  },
  upstream: 'https://parity0.kovan.makerfoundation.com:8545'
}


app.use((req, res, next) => {
  req.setEncoding('utf8');
  req.rpc = '';
  req.on('data', chunk => req.rpc += chunk);
  req.on('end', () => next());
});

http.createServer(app).listen(config.server.port, config.server.host);


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
