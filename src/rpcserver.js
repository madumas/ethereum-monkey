const http = require('http');
const express = require('express');
const axios = require('axios');
const txDecoder = require('ethereum-tx-decoder');
const web3 = require('web3');
const app = express();
const httpTerminator = require('http-terminator');

axios.defaults.headers.post['Content-Type'] = 'application/json';

let config, server;

function RpcServer(conf) {
  config = conf;
}

RpcServer.prototype.start= function() {

  app.use((req, res, next) => {
    req.setEncoding('utf8');
    req.rpc = '';
    req.on('data', chunk => req.rpc += chunk);
    req.on('end', () => next());
  });

  server = http.createServer(app).listen(config.port, config.host);
  console.log("Waiting for connections on " + config.host + ":" + config.port);

  app.post('/', function (request, response,) {
    let rpc;

    try {
      rpc = JSON.parse(request.rpc);
    } catch (e) {
      return response.status(500).send({
        code: -32700,
        message: 'Parse error'
      });
    }

    setTimeout(function () {
      if (Math.random() < config.rpcErrorRate) {
        console.log('Injecting error on ' + request.rpc);
        response.status(500).send(JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Ethereum Monkey Injected Error'
          },
          id: rpc.id
        }));
        return;
      }

      if (rpc.method === 'eth_sendRawTransaction') {
        const decodedData = txDecoder.decodeTx(rpc.params[0]);
        const txHash = web3.utils.keccak256(rpc.params[0]);

        if (Math.random() < config.txErrorRate || decodedData.gasPrice.toNumber() < config.minGas * 1E9) {
          console.log('Dropped transaction ' + txHash);
          response.status(200).send(JSON.stringify({
            jsonrpc: '2.0',
            result: txHash,
            id: rpc.id
          }));
          return;
        }
      }

      axios.post(config.upstream, request.rpc).then((res) => {
        let responseData = res.data;
        response.status(res.status).send(responseData);
      }).catch(e => {
        console.log(e);
        response.status(e.response.status).send(e.response.data);
      });
    }, config.delay);
  });


  app.use(function (req, res,) {
    return res.status(404).send({
      code: -32601,
      message: "Not found"
    });
  });

};

RpcServer.prototype.stop= function() {
  const terminator = httpTerminator.createHttpTerminator({server});

  return terminator.terminate();
};

module.exports = RpcServer;
module.exports.app = app;
