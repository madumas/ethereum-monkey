/**
 * @jest-environment node
 */

const RpcServer = require("../src/rpcserver");
const Web3 = require('web3');
const bip39 = require('bip39');
const {hdkey} = require('ethereumjs-wallet');
const testchainMnemonic = "hill law jazz limb penalty escape public dish stand bracket blue jar";
const EthereumTx = require('ethereumjs-tx').Transaction

const seed = bip39.mnemonicToSeedSync(testchainMnemonic); // mnemonic is the string containing the words
const hdk = hdkey.fromMasterSeed(seed);
const addr_node = hdk.derivePath("m/44'/60'/0'/0/0"); //m/44'/60'/0'/0/0 is derivation path for the first account. m/44'/60'/0'/0/1 is the derivation path for the second account and so on
const ethFrom = addr_node.getWallet().getAddressString(); //check that this is the same with the address that ganache list for the first account to make sure the derivation is correct
const private_key = addr_node.getWallet().getPrivateKey();

const sleep = async function(delay) {await new Promise((r) => setTimeout(r, delay));}

function genTx(nonce,gasPrice) {
  const tx = new EthereumTx({
    from: ethFrom,
    to: ethFrom,
    value: 0,
    nonce:nonce,
    gasPrice:gasPrice,
    gasLimit:100000
  });
  tx.sign(private_key);
  return '0x'+tx.serialize().toString('hex');
}

test('basic request', async () => {
  const server = new RpcServer({upstream:'http://localhost:2000', host:'0.0.0.0', port:'8554'});
  server.start();
  await new Promise((r) => setTimeout(r, 1000));

  const web3 = new Web3('http://localhost:2000');
  expect(typeof await web3.eth.getNodeInfo()).toBe('string');
  await server.stop();
});

test('normal tx', async () => {
  const server = new RpcServer({upstream:'http://localhost:2000', host:'127.0.0.1', port:'8554'});
  server.start();
  await sleep(1000);
  const web3 = new Web3('http://localhost:8554');

  const nonce = await web3.eth.getTransactionCount(ethFrom);
  const serializedTx = genTx(nonce,1E9);
  await new Promise((resolve)=> {
    web3.eth.sendSignedTransaction(serializedTx)
      .once('transactionHash', async hash => {
        expect(hash).toContain('0x');
      })
      .once('receipt', receipt=>{
        expect(receipt.status).toBeTruthy();
        resolve();
      });
  });
  await server.stop();
},10000);

test('dropped tx', async () => {
  const server = new RpcServer({upstream:'http://localhost:2000', host:'0.0.0.0', port:'8554',minGas:2});
  server.start();
  await sleep(1000);
  const web3 = new Web3('http://localhost:8554');

  const nonce = await web3.eth.getTransactionCount(ethFrom);
  const serializedTx = genTx(nonce,1E9);

  const hash = await new Promise((resolve)=> {
    web3.eth.sendSignedTransaction(serializedTx)
      .once('transactionHash', async hash => {
        expect(hash).toContain('0x');
        resolve(hash);
      })
  });

  await sleep(2000);
  const receipt = await web3.eth.getTransactionReceipt(hash);
  expect(receipt).toBeNull();
  await server.stop();
},10000);

