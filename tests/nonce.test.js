const RpcServer = require("../src/rpcserver");
const Web3 = require('web3');

test('basic request', async () => {
  const server = new RpcServer({upstream:'http://localhost:2000', host:'0.0.0.0', port:'8554'});
  server.start();
  await new Promise((r) => setTimeout(r, 1000));
  //const request = supertest(server.app);
  const web3 = new Web3('http://localhost:2000');
  expect(typeof await web3.eth.getNodeInfo()).toBe('string');
  await server.stop();
});

