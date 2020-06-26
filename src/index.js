const RpcServer = require("./rpcserver");

let argv = require('yargs')
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
console.assert(argv.txErrorRate >= 0 && argv.txErrorRate < 1, "Please specify txErrorRate between 0.0 and 1.0");
console.assert(argv.minGas >= 0, "Please specify minGas greater than 0");
console.assert(argv.delay >= 0, "Cannot simulate shorter-than-normal latencies");
console.assert(argv.rpcErrorRate >= 0 && argv.rpcErrorRate < 1, "Please specify rpcErrorRate between 0.0 and 1.0");

const rpcServer = new RpcServer(argv);
rpcServer.start();
