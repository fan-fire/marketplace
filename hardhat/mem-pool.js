var url = 'wss://speedy-nodes-nyc.moralis.io/7ef9901b6b3e016589e433fb/polygon/mainnet/ws';
var ethers = require('ethers');

let importantAddresses = [
  '0x776f19e816c582a740e00439a9799114a56155bc',
  '0x4ffc2f1adbc4679f954d0c105f7c9dcd00e38729',
  '0xc073cf3940c116562fba21d690ff2121a75844fd',
].map(function (address) {
  return address.toLocaleLowerCase();
});

var init = function () {
  var customWsProvider = new ethers.providers.WebSocketProvider(url);

  customWsProvider.on('error', function (error) {
    console.log('Error: ' + error);
  });


  customWsProvider.on('pending', (tx) => {
    customWsProvider.getTransaction(tx).then(function (transaction) {
      //   console.log(transaction);
      if (transaction) {
        if (importantAddresses.indexOf(transaction.from.toLocaleLowerCase()) > -1) {
          console.log('important transaction');
          console.log(transaction);
        }else{
        console.log(
          `${transaction.blockNumber} Pending: ${transaction.gasPrice.toString()}, ${transaction.from.toLocaleLowerCase()} Nonce:${transaction.nonce}`
        );
        }

      } else {
        console.log('Transaction not found');
      }
    });
  });

 
  customWsProvider._websocket.on('error', async () => {
    // console.log(`Unable to connect to ${ep.subdomain} retrying in 3s...`);
    setTimeout(init, 3000);
  });
  customWsProvider._websocket.on('close', async (code) => {
    console.log(`Connection lost with code ${code}! Attempting reconnect in 3s...`);
    customWsProvider._websocket.terminate();
    setTimeout(init, 3000);
  });
};

init();
