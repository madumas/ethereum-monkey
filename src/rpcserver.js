const http = require('http');
const express = require('express');
const axios = require('axios');
const ethers = require('ethers');
const web3 = require('web3');
const app = express();
const httpTerminator = require('http-terminator');

axios.defaults.headers.post['Content-Type'] = 'application/json';

let config, server;
let skippedTx={};

const biggestSkippedNonce = function(addr) {
  let nonce=-1;
  if (skippedTx[addr]) {
    nonce = skippedTx[addr].length-1;
  }
  return nonce
};

function RpcServer(conf) {
  config = conf;
  skippedTx={};
}

async function sendTransaction(request,response,signedTx) {
  if(request&&response) {
    const res=await axios.post(config.upstream, request.rpc).catch(e => {
      console.log(e);
      response.status(e.response.status).send(e.response.data);
    });
    let responseData = res.data;
    response.status(res.status).send(responseData);
  } else {
    await axios.post(config.upstream, JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_sendRawTransaction',
      params: signedTx,
      id: 1
    })).catch(e => {
      console.log(e);
    });
  }
}

function processSendTransaction(rawTx,request,response,rpc) {

  const decodedData = ethers.utils.parseTransaction(rawTx);
  const txHash = web3.utils.keccak256(rawTx);
  if (Math.random() < config.txErrorRate
    || decodedData.gasPrice.toNumber() < config.minGas * 1E9
    || (biggestSkippedNonce(decodedData.from)!==-1 &&decodedData.nonce>biggestSkippedNonce(decodedData.from))
  ) {
    console.log('Queued transaction with Nonce ' + decodedData.nonce);
    skippedTx[decodedData.from]=skippedTx[decodedData.from]||[];
    skippedTx[decodedData.from][decodedData.nonce]=rawTx;
    if (response) response.status(200).send(JSON.stringify({
      jsonrpc: '2.0',
      result: txHash,
      id: rpc.id
    }));
  } else {
    if (skippedTx[decodedData.from] && skippedTx[decodedData.from][decodedData.nonce]) {
      //this is a new tx for an existing transaction
      sendTransaction(request,response,skippedTx[decodedData.from][decodedData.nonce]).then(()=> {
        delete (skippedTx[decodedData.from][decodedData.nonce]);
        //check if there are others in queue and process them
        let queuedTx;
        while (skippedTx[decodedData.from].length > 0) {
          if ((queuedTx = skippedTx[decodedData.from].shift()) !== undefined) {
            console.log('Reprocessing: ' + queuedTx);
            processSendTransaction(queuedTx, null, null, null);
          }
        }
      });

    } else {
      sendTransaction(request,response,rawTx).then();
    }
  }
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
        processSendTransaction(rpc.params[0],request,response,rpc);
      } else {
        axios.post(config.upstream, request.rpc).then((res) => {
          let responseData = res.data;
          response.status(res.status).send(responseData);
        }).catch(e => {
          console.log(e);
          response.status(e.response.status).send(e.response.data);
        });
      }
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
