const { ethers } = require('ethers');
// const erc20Abi = require('erc-20-abi');

// method that takes two times as '18:00' and '14:17' and calcualtes the seconds between them
const calcSecondsBetweenTwoTimes = (time1, time2) => {
  console.log(`time1: ${time1}`);
  console.log(`time2: ${time2}`);
  let time1Arr = time1.split(':');
  let time2Arr = time2.split(':');
  let time1Seconds =
    parseInt(time1Arr[0]) * 3600 + parseInt(time1Arr[1]) * 60 + parseInt(time1Arr[2]);
  let time2Seconds =
    parseInt(time2Arr[0]) * 3600 + parseInt(time2Arr[1]) * 60 + parseInt(time2Arr[2]);
  console.log(`time1Seconds: ${time1Seconds}`);
  console.log(`time2Seconds: ${time2Seconds}`);
  return time2Seconds - time1Seconds;
};

const formatUnits = ethers.utils.formatUnits;
const BigNumber = ethers.BigNumber;

const MARKETPLACE_ABI = require('../../marketplace/build/contracts/Marketplace.json').abi;
const FF721_ABI =
  require('../../finnige-fanie/projects/202203280851_strijdom_mainnet_v2/truffle/build/contracts/FF721.json').abi;

const MARKETPLACES_ADDRESSES = {
  137: '0xdfD1A784E63Ac5AC2E13E76B461C161839c3e3fD',
  80001: '0xf614592E8581aCc8bCa009554e5468B28d87Db20',
};
const NFT_ADDRESSES = { 137: '0xb6f5de4b6a56382a7d70d6a8e6b7241e14b1901c' };

const getRpcUrl = (chainId) => {
  switch (chainId) {
    case 80001:
      return 'https://speedy-nodes-nyc.moralis.io/7ef9901b6b3e016589e433fb/polygon/mumbai';
    case 137:
      return 'https://polygon-rpc.com';
    // general case
    default:
      throw new Error(`Chain ID ${chainId} is not supported`);
  }
};

const CHAIN_IDS = {
  mainnet: 137,
  mumbai: 80001,
};

const tx = async (provider, contract, wallet, method, args, multipliers, nrConfirms) => {
  const { gasLimitMul, gasPriceMul } = multipliers;
  const gasLimitMultiplierNum = gasLimitMul.num || BigNumber.from(10);
  const gasLimitMultiplierDen = gasLimitMul.den || BigNumber.from(10);
  const gasPriceMultiplierNum = gasPriceMul.num || BigNumber.from(10);
  const gasPriceMultiplierDen = gasPriceMul.den || BigNumber.from(10);

  let { maxFeePerGas, maxPriorityFeePerGas, gasPrice } = await provider.getFeeData();
  console.log(`Gas Price: ${formatUnits(gasPrice, 'gwei')}`);
  console.log(`Max Fee Per Gas: ${formatUnits(maxFeePerGas, 'gwei')}`);
  console.log(`Max Priority Fee Per Gas: ${formatUnits(maxPriorityFeePerGas, 'gwei')}`);

  let unsignedTx = {};

  try {
    // get binarised data
    unsignedTx = await contract.populateTransaction[method](...args);
    console.log('unsignedTx', unsignedTx);
  } catch (e) {
    console.log(e);
  }

  console.log(`Getting gas estimate for method=${method}`);

  let gasEstimate = await provider.estimateGas(unsignedTx);

  console.log(`Gas Estimate Before Multiplier: ${gasEstimate}`);
  gasEstimate = gasEstimate.mul(gasLimitMultiplierNum).div(gasLimitMultiplierDen);
  console.log(`Gas Estimate After Multiplier: ${gasEstimate}`);

  console.log(`Gas Price Before Multiplier: ${formatUnits(gasPrice, 'gwei')}`);
  gasPrice = gasPrice.mul(gasPriceMultiplierNum).div(gasPriceMultiplierDen);
  console.log(`Gas Price After Multiplier: ${formatUnits(gasPrice, 'gwei')}`);

  unsignedTx.gasLimit = gasEstimate;
  unsignedTx.gasPrice = gasPrice;
  unsignedTx.chainId = (await provider.getNetwork()).chainId;
  unsignedTx.nonce = await provider.getTransactionCount(wallet.address);

  console.log('unsignedTx', unsignedTx);

  const signedTX = await wallet.signTransaction(unsignedTx);

  let duration = undefined;
  try {
    const startTime = new Date().getTime();
    const txReceipt = await provider.sendTransaction(signedTX);
    await txReceipt.wait((confirms = nrConfirms));
    const endTime = new Date().getTime();
    duration = endTime - startTime;
    let now = new Date();
    console.log(`${now.toLocaleString()}`);
    console.log('txReceipt', txReceipt);
    console.log(`Duration (ms): ${duration}`);
  } catch (e) {
    console.log(e);
  }

  return duration;
};

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};
const main = async () => {
  //   Toggle between mumbai and mainnet
  //   const chainId = CHAIN_IDS.mumbai;
  const chainId = CHAIN_IDS.mainnet;
  const rpcUrl = getRpcUrl(chainId);

  const privateKey = 'process.env.FANIE_PK';

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const multipliers = {
    gasLimitMul: {
      num: BigNumber.from(300),
      den: BigNumber.from(100),
    },
    gasPriceMul: {
      num: BigNumber.from(130),
      den: BigNumber.from(100),
    },
  };
  let nrConfirms = 1;

  const marketplaceContract = new ethers.Contract(
    MARKETPLACES_ADDRESSES[chainId],
    MARKETPLACE_ABI,
    wallet
  );

  let nftAddress = '0xb6f5de4b6a56382a7d70d6a8e6b7241e14b1901c';
  let tokenId;
  let period;
  let reservee = '0xFdD72142CA8cE7dC492cDe17557c16d8cbc17c1B';

  let method = 'reserve';
  let args = [nftAddress, tokenId, period, reservee];

  // 18:00 - 14:17

  let availableTimes = {
    // 0: '18:00:00', // R4000 Dry Sea Kelp Words (0)
    1: '13:00:00'
  };


// Feathery reed 6.5
// Floating geo 7
// Dried kelp 8
// Dried kelp words 10

  const nameLookups = {
    // 0: 'Forest Leaves',
    1: "Dried Kelp As A Rectangle"
  }

  // R1000 Japanese Tree Moss, Cotton X of Prague, Dry Pan Water Ripples

  const now = '09:06:00';
  let reservePeriods = {};
  console.log(Object.keys(availableTimes));
  for (let i = 0; i < Object.keys(availableTimes).length; i++) {
    let key = Object.keys(availableTimes)[i];
    let time = availableTimes[key];
    reservePeriods[key] = calcSecondsBetweenTwoTimes(now, time);
    // delete availableTimes[key];
  }

  console.log('reservePeriods', reservePeriods);

  for (let i = 0; i < Object.keys(reservePeriods).length; i++) {
    let key = Object.keys(reservePeriods)[i];
    let time = reservePeriods[key];
    console.log(`${key}: ${time}`);
    tokenId = key;
    period = time;
    // period = 60;
    args = [nftAddress, tokenId, period, reservee];
    console.log(`${method} ${args}`);
    await tx(provider, marketplaceContract, wallet, method, args, multipliers, nrConfirms);
  }

  let allListings = await marketplaceContract.getAllListings();

  allListings = allListings.filter((listing) => {
    console.log(listing.nftAddress)
    return listing.nftAddress.toLowerCase() == nftAddress.toLowerCase() && 
      listing.reservedFor.toLowerCase() == reservee.toLowerCase()
  });

  const timeSinceEpochToDate = (timeSinceEpoch) => {
    const date = new Date(timeSinceEpoch * 1000);
    return date.toLocaleString();
  };

  console.log('allListings', allListings);
  allListings.forEach((listing) => {
    console.log(`Reserved Until: ${timeSinceEpochToDate(listing.reservedUntil)}: ${nameLookups[listing.tokenId]}`);
  });
};

main();
