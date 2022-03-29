const Marketplace = artifacts.require('Marketplace');
const MarketplaceProxy = artifacts.require('MarketplaceProxy');
const RESERVER_ADDRESS = '0xc073Cf3940C116562FBa21d690FF2121A75844FD';
const RESERVER_ROLE = web3.utils.soliditySha3('RESERVER_ROLE');

const erc20Addresses = {
  mumbai: {
    FAN: '0x1e65Cd156fe76d68B15C5f2Fa8B42C32Af5af048',
  },
  development: {
    USDT: '0x3813e82e6f7098b9583fc0f33a962d02018b6803',
  },
  polygon_trezor: {
    USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  },
  polygon: {
    USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  },
};

const sleep = (ms) => {
  console.log('sleeping for', ms, 'ms');
  return new Promise((resolve) => setTimeout(resolve, ms));
};

module.exports = async (deployer, network, accounts) => {
  console.log(`deploying Marketplace on ${network} using accounts: ${accounts}`);

  if (network !== 'development') {
    await sleep(7500);
  }
  const addresses = Object.values(erc20Addresses[network]);
  const names = Object.keys(erc20Addresses[network]);

  console.log('deploying Marketplace');

  await deployer.deploy(Marketplace);
  if (network !== 'development') {
    await sleep(7500);
  }

  console.log('deploying MarketplaceProxy');

  let marketplace = await Marketplace.deployed();
  await deployer.deploy(MarketplaceProxy, marketplace.address);

  const marketplaceProxy = await MarketplaceProxy.deployed();
  console.log(`MarketplaceProxy address: ${marketplaceProxy.address}`);
  console.log(`Marketplace address: ${marketplace.address}`);

  marketplace = await Marketplace.at(marketplaceProxy.address);

  console.log('adding ERC20 tokens');

  if (addresses.length > 0) {
    for (let i = 0; i < addresses.length; i++) {
      const coin = names[i];
      const coinAddress = addresses[i];
      console.log(`adding ${coin}`);
      if (network !== 'development') {
        await sleep(10000);
      }
      await marketplace.addPaymentToken(coinAddress);
      console.log(`Added ${coin} to Marketplace`);
    }
  }

  if (network !== 'development') {
    await sleep(7500);
  }
  console.log('Adding Fanie as a reserver');
  await marketplace.grantRole(RESERVER_ROLE, RESERVER_ADDRESS);
};
