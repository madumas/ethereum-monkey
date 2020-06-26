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
  if (skippedTx[addr.toLowerCase()]) {
    nonce = skippedTx[addr.toLowerCase()].length-1;
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
      params: [signedTx],
      id: 1
    })).catch(e => {
      console.log(e);
    });
  }
}

function processSendTransaction(rawTx,request,response,rpc) {

  const decodedData = ethers.utils.parseTransaction(rawTx);
  const txHash = web3.utils.keccak256(rawTx);
  const from=decodedData.from.toLowerCase();
  if (Math.random() < config.txErrorRate
    || decodedData.gasPrice.toNumber() < config.minGas * 1E9
    || (biggestSkippedNonce(decodedData.from)!==-1 &&decodedData.nonce>biggestSkippedNonce(decodedData.from))
  ) {
    console.log('Queued transaction with Nonce ' + decodedData.nonce);
    skippedTx[from]=skippedTx[from]||[];
    skippedTx[from][decodedData.nonce]=rawTx;
    if (response) response.status(200).send(JSON.stringify({
      jsonrpc: '2.0',
      result: txHash,
      id: rpc.id
    }));
  } else {
    if (skippedTx[from] && skippedTx[from][decodedData.nonce]) {
      //this is a new tx for an existing transaction
      sendTransaction(request,response,skippedTx[from][decodedData.nonce]).then(()=> {
        delete (skippedTx[from][decodedData.nonce]);
        //check if there are others in queue and process them
        let queuedTx;
        while (skippedTx[from].length > 0) {
          if ((queuedTx = skippedTx[from].shift()) !== undefined) {
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

  app.post('/*', function (request, response,) {
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
        return;
      }

      if ((rpc.method === 'eth_getTransactionCount')
        || rpc.method === 'parity_nextNonce') {
        const localNonce=biggestSkippedNonce(rpc.params[0]);
        if (localNonce!==-1) {
          response.status(200).send(JSON.stringify({
            jsonrpc: '2.0',
            result: Number(localNonce+1).toString(16),
            id: rpc.id
          }));
          return;
        }
      }

      if (rpc.method === 'parity_pendingTransactions') {
        const from=rpc.params[0].toLowerCase();
        const pendingTxs = skippedTx[from].filter(rawTx=>rawTx!==null).map( (rawTx,nonce) => {
          if (rawTx) {
            const decodedData = ethers.utils.parseTransaction(rawTx);
            return {
              "blockHash": null,
              "blockNumber": null,
              "creates": null,
              "from": decodedData.from,
              "gas": decodedData.gasLimit.toHexString(),
              "gasPrice": decodedData.gasPrice.toHexString(),
              "hash": decodedData.hash,
              "input": decodedData.data,
              "chainId": decodedData.chainId,
              "nonce": decodedData.nonce,
              "publicKey": null,
              "r": decodedData.r,
              "raw": rawTx,
              "s": decodedData.s,
              "standardV": "0x1",
              "to": decodedData.to,
              "transactionIndex": null,
              "v": decodedData.v,
              "value": decodedData.value
            }
          }
        });
        response.status(200).send(JSON.stringify({
          jsonrpc: '2.0',
          result: JSON.stringify(pendingTxs),
          id: rpc.id
        }));
        return;
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
