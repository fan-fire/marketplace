const { ethers } = require('ethers');
const formatUnits = ethers.utils.formatUnits;
const BigNumber = ethers.BigNumber;

let db_block;

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
  const chainId = CHAIN_IDS.mainnet;
  const rpcUrl = getRpcUrl(chainId);
  const privateKey = process.env.ACC1_PK;
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  db_block = await provider.getBlockNumber();
  db_nonce = await provider.getTransactionCount(wallet.address);

  console.log(`db_nonce: ${db_nonce}`);
  console.log(`db_block: ${db_block}`);
  let new_nonce = await newNonce(provider, wallet);
  console.log(`new_nonce: ${new_nonce}`);

  const listStats = await list(provider, wallet, multipliers, nrConfirms);
};


const newNonce = async (provider, wallet) => {

    let new_block = await provider.getBlockNumber();
    while(new_block == db_block) {
        new_block = await provider.getBlockNumber();
    }
    db_block = new_block;
    const nonce = await provider.getTransactionCount(wallet.address, 'pending');

    return nonce;

}

main();
