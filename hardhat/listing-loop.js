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
  //   const multipliers = {
  //     gasLimitMul: {
  //       num: BigNumber.from(300),
  //       den: BigNumber.from(100),
  //     },
  //     gasPriceMul: {
  //       num: BigNumber.from(130),
  //       den: BigNumber.from(100),
  //     },
  //   };
  //   let nrConfirms = 1;

  let sweep = {
    nrConfirms: [3, 2, 1],
    multipliers: [
      {
        gasLimitMul: {
          num: BigNumber.from(150),
          den: BigNumber.from(100),
        },
        gasPriceMul: {
          num: BigNumber.from(300),
          den: BigNumber.from(100),
        },
      },
      {
        gasLimitMul: {
          num: BigNumber.from(150),
          den: BigNumber.from(100),
        },
        gasPriceMul: {
          num: BigNumber.from(200),
          den: BigNumber.from(100),
        },
      },
      {
        gasLimitMul: {
          num: BigNumber.from(150),
          den: BigNumber.from(100),
        },
        gasPriceMul: {
          num: BigNumber.from(150),
          den: BigNumber.from(100),
        },
      },
    ],
  };

  let stats = [];
  let runStats = {};

  for (let j = sweep.multipliers.length - 1; j >= 0; j--) {
    for (let i = sweep.nrConfirms.length - 1; i >= 0; i--) {
      nrConfirms = sweep.nrConfirms[i];
      multipliers = sweep.multipliers[j];
      console.log(`nrConfirms: ${nrConfirms}`);
      console.log(`multipliers: ${JSON.stringify(multipliers)}`);
      runStats['nrConfirms'] = nrConfirms;
      runStats['gasMultiplier'] =
        Number(multipliers['gasPriceMul']['num'].toString()) /
        Number(multipliers['gasPriceMul']['den'].toString());

      try {
        const listStats = await list(provider, wallet, multipliers, nrConfirms);
        runStats['listStats'] = listStats;
      } catch (e) {
        console.log('Cant list NFT');
        await sleep(5000);
        console.log('Unlisting');
        await unlist(provider, wallet, multipliers, nrConfirms);
        console.log('Unlisted');
        runStats['listStats'] = 'failed';
      }

      try {
        const unlistStats = await unlist(provider, wallet, multipliers, nrConfirms);
        runStats['unlistStats'] = unlistStats;
      } catch (e) {
        // console.log(e);
        console.log('Cant unlist NFT');
        await sleep(5000);
        runStats['unlistStats'] = 'failed';
      }

      stats.push({...runStats});
      console.log(JSON.stringify(stats));
    }
  }

  console.log(`stats: ${JSON.stringify(stats)}`);

  //   let listStats = await list(provider, wallet, multipliers, nrConfirms);
  //   let unliststats = await unlist(provider, wallet, multipliers, nrConfirms);
  //   console.log(listStats);
  //   console.log(unliststats);
};

main();
