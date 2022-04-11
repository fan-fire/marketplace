const { ethers } = require('ethers');
// const erc20Abi = require('erc-20-abi');

const formatUnits = ethers.utils.formatUnits;
const BigNumber = ethers.BigNumber;

const MARKETPLACE_ABI = require('../../marketplace/build/contracts/Marketplace.json').abi;
const FF721_ABI =
  require('../../finnige-fanie/projects/202203280851_strijdom_mainnet_v2/truffle/build/contracts/FF721.json').abi;

const MARKETPLACES_ADDRESSES = {
  137: '0xED9E6336E40787e3D1d7BBf13b2d911f6858AEde',
  80001: '0xf614592E8581aCc8bCa009554e5468B28d87Db20',
};
const NFT_ADDRESSES = { 137: '0xCc02Ae547079d8DCE9487BC5D88C9386d7266E1f' };

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

const list = async (provider, wallet, multipliers, nrConfirms) => {
  const stats = [];

  const chainId = (await provider.getNetwork()).chainId;
  console.log(`Chain ID: ${chainId}`);
  const marketplaceContract = new ethers.Contract(
    MARKETPLACES_ADDRESSES[chainId],
    MARKETPLACE_ABI,
    wallet
  );
  console.log(`Marketplace Address: ${marketplaceContract.address}`);
  const nftContract = new ethers.Contract(NFT_ADDRESSES[chainId], FF721_ABI, wallet);
  console.log(`NFT Address: ${nftContract.address}`);

  let contract;
  let method;
  let args;
  let duration;
  let nftAddress;
  let tokenId;
  let price;
  let paymentToken;

  // List NFT
  contract = marketplaceContract;
  method = 'list';
  nftAddress = nftContract.address;
  tokenId = 2;
  price = ethers.utils.parseEther('0.1');
  paymentToken = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
  args = [nftAddress, tokenId, price, paymentToken];
  duration = await tx(provider, contract, wallet, method, args, multipliers, nrConfirms);
  stats.push({ method, duration, nrConfirms, args });
  return stats;
};

const reapprove = () => {
  //   // unapprove NFT
  //   contract = nftContract;
  //   method = 'setApprovalForAll';
  //   args = [marketplaceContract.address, false];
  //   duration = await tx(provider, contract, wallet, method, args, multipliers, nrConfirms);
  //   stats.push({ method, duration, nrConfirms, args });
  //   // approve NFT
  //   contract = nftContract;
  //   method = 'setApprovalForAll';
  //   args = [marketplaceContract.address, true];
  //   duration = await tx(provider, contract, wallet, method, args, multipliers, nrConfirms);
  //   stats.push({ method, duration, nrConfirms, args });
};
const unlist = async (provider, wallet, multipliers, nrConfirms) => {
  const stats = [];

  const chainId = (await provider.getNetwork()).chainId;
  console.log(`Chain ID: ${chainId}`);
  const marketplaceContract = new ethers.Contract(
    MARKETPLACES_ADDRESSES[chainId],
    MARKETPLACE_ABI,
    wallet
  );
  console.log(`Marketplace Address: ${marketplaceContract.address}`);
  const nftContract = new ethers.Contract(NFT_ADDRESSES[chainId], FF721_ABI, wallet);
  console.log(`NFT Address: ${nftContract.address}`);

  let contract;
  let method;
  let args;
  let duration;
  let nftAddress;
  let tokenId;
  let price;
  let paymentToken;

  // Unlist NFT
  contract = marketplaceContract;
  method = 'unlist';
  nftAddress = nftContract.address;
  tokenId = 2;
  args = [nftAddress, tokenId];
  duration = await tx(provider, contract, wallet, method, args, multipliers, nrConfirms);
  stats.push({ method, duration, nrConfirms, args });
  return stats;
};

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};
const main = async () => {
  //   Toggle between mumbai and mainnet
  //   const chainId = CHAIN_IDS.mumbai;
  const chainId = CHAIN_IDS.mainnet;
  const rpcUrl = getRpcUrl(chainId);

  const privateKey = process.env.ACC1_PK;

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  
  const nfts = [
    '0xD659977429C24ad10f597c3ed6c8C330B4aD4a28',
    '0xc286859eC3B9A995C495935172B3f29e74504564',
    '0xb3772ec74750c224aafd2e1316560627dd71b017',
    '0xabaece1ba2f1ca1f37e8f95dc2db6468bceb73cb',
    '0xF4d22952A09c7e9012c78E0206995449F2ba4525'];

  const marketplaceContract = new ethers.Contract(
    MARKETPLACES_ADDRESSES[chainId],
    MARKETPLACE_ABI,
    wallet
  );

  let listings = await marketplaceContract.getAllListings()

  console.log(listings)

  listings.forEach(async (listing) => {

    console.log(`${listing.nftAddress}:${listing.tokenId}\n\t\tReserved Until: ${epochTimeToDatetime(listing.reservedUntil)}\n\t\tReserved For: ${listing.reservedFor}`)
  })


};

// in format YYYY-MM-DD HH:MM:SS
const epochTimeToDatetime = (epochTime) => {
  const date = new Date(epochTime * 1000);
  return date.toLocaleString();
};


main();
