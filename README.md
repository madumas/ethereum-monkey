# ethereum-monkey
Reproduce unfavorable Ethereum network conditions for load testing off-chain keepers and bots.

## Features
- randomly drop a percentage of submitted transactions
- drop transactions under a minimum gas price
- delay calls to simulate high connection latency
- randomly simulate errors for a percentage of RPC requests 

## Installation
`npm install`

## Usage
Run `node src/index.js --help` to list arguments.

Example which should not introduce chaos:
```
node src/index.js --upstream "https://kovan.myethereumnode.org/api_key"
```

Randomly drop 2% of transactions, drop any transaction with under 45.9 GWEI gas price, delay all responses by 10 ms, 
randomly return an error response for 0.5% of RPC calls.
```
node src/index.js --upstream "https://kovan.myethereumnode.org/api_key" \
  --txErrorRate 0.02 \
  --minGas 45.9 \
  --delay 10 \
  --rpcErrorRate 0.005
```