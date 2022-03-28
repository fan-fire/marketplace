const { ethers } = require('ethers');
const axios = require('axios').default;

const nftABI =
  require('../../finnige-fanie/projects/202203101212/truffle/build/contracts/FF721.json').abi;
const marketplace = require('../build/contracts/Marketplace.json').abi;
const erc20ABI = require('../build/contracts/ERC20.json').abi;

// chain: ['polygon', 'mumbai']
// speed: ['safeLow', 'standard', 'fast']
const getGas = async (chain, speed, provider) => {
  let url;
  switch (chain) {
    case 'mumbai':
      url = 'https://gasstation-mumbai.matic.today/v2';
      break;
    case 'polygon':
      url = 'https://gasstation-mainnet.matic.network/v2';
      break;
  }

  const response = await axios.get(url);
  console.log(response.data);

  let gasPrice = ethers.utils.parseUnits(response.data[speed].maxFee.toFixed(9).toString(), 'gwei');

  let lastBlockNumber = response.data.blockNumber;
  let lastBlock = await provider.getBlock(lastBlockNumber);
  let gasLimit = lastBlock.gasLimit;

  console.log(gasPrice);
  console.log(gasLimit);

  return { gasPrice, gasLimit };
};

const main = async () => {
  const provider = new ethers.providers.JsonRpcProvider(process.env.POLYGON_NODE);

  const marketplaceAddr = '0xED9E6336E40787e3D1d7BBf13b2d911f6858AEde';
  const fanAddr = '0xbC2937E8417944cAea23e22eaC3f4bd8fFe21553';
  const usdcAddr = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
  const nftAddr = '0x2EAF0e71aA52d7587526904202509Eb45CDD9850';
  const contractOwner = '0xC4E9C436C4aB9071F996487811F7FeC7CdeE16a7';
  const nftOwnerAddr = '0xC9B40BB948F1CE6F9B68d15c1Fb8df54aAD5E532';
  const royaltyBenAddr = '0xC4E9C436C4aB9071F996487811F7FeC7CdeE16a7';

  const nftOwnerPK = 'd36ce0502f2964b7717c73e5027b0b2da334dc5d97b3f5a56da35c8cd29ddbbe';
  const contractOwnerPK = '160006a91dbf8decc86657ee6428382a647929938da851be2b1bb5d61ae8aa55';

  const nftOwnerWallet = new ethers.Wallet(nftOwnerPK, provider);
  const contractOwnerWallet = new ethers.Wallet(contractOwnerPK, provider);
  const nftContract = new ethers.Contract(nftAddr, nftABI, nftOwnerWallet);

  let marketplaceContract = new ethers.Contract(marketplaceAddr, marketplace, nftOwnerWallet);
  const erc20Contract = new ethers.Contract(usdcAddr, erc20ABI, contractOwnerWallet);

  //   console.log('Checking approved tokens');
  //   try {
  //     const fanApproved = await marketplaceContract.isPaymentToken(fanAddr);
  //     console.log(`fanApproved: ${fanApproved}`);
  //     const usdcApproved = await marketplaceContract.isPaymentToken(usdcAddr);
  //     console.log(`usdcApproved: ${usdcApproved}`);
  //   } catch (err) {
  //     console.log(err);
  //   }

  //   try {
  //     const numListings = await marketplaceContract.numListings();
  //     console.log(`numListings: ${numListings}`);
  //   } catch (err) {
  //     console.log(err);
  //   }

  let gasInfo = await getGas('polygon', 'fast', provider);
  console.log(gasInfo);
  console.log(ethers.utils.formatUnits(gasInfo.gasPrice, 'gwei'));
  console.log(ethers.utils.formatUnits(gasInfo.gasLimit, 'wei'));

  // console.log('Setting approval for all');
  // try{
  //     await nftContract.setApprovalForAll(marketplaceAddr, true);

  // }catch(err){
  //     console.log(err);
  // }

  // console.log('Listing');
  // try {
  //   const tx = await marketplaceContract.list(
  //     nftAddr,
  //     new ethers.BigNumber.from(2),
  //     new ethers.BigNumber.from(1),
  //     usdcAddr,
  //     {
  //       gasPrice: gasInfo.gasPrice,
  //       gasLimit: 1003696
  //     }
  //   );

  //   console.log(tx);

  //   await tx.wait();

  // //   await provider.waitForTransaction(tx.hash, 5);
  // } catch (err) {
  //   console.log(err);
  // }

  //   console.log('Checking listing');
  //   try {
  //     const listing = await marketplaceContract.getListing(nftAddr, 1);
  //     console.log(listing);
  //     // console.log(tx);
  //   } catch (err) {
  //     console.log(err);
  //   }

  //   try {
  //     let tx = await erc20Contract.approve(marketplaceContract.address, 1,
  //         {
  //             gasPrice: gasInfo.gasPrice,
  //             gasLimit: 1003696
  //         });

  //     console.log(tx);
  //     await tx.wait();
  //   } catch (err) {
  //     console.log(err);
  //   }

  // marketplaceContract = new ethers.Contract(marketplaceAddr, marketplace, contractOwnerWallet);
  // console.log('buy');
  // try {
  //   const tx = await marketplaceContract.buy(nftAddr, 2, {
  //     gasPrice: gasInfo.gasPrice,
  //     gasLimit: 1003696,
  //   });

  //   console.log(tx);
  //   await tx.wait();
  //   //   await provider.waitForTransaction(tx.hash, 5);
  // } catch (err) {
  //   console.log(err);
  // }
};

main();
