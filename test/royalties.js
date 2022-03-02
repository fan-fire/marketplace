const Marketplace = artifacts.require('Marketplace');
const MarketplaceProxy = artifacts.require('MarketplaceProxy');
const ERC721Mock = artifacts.require('ERC721Mock');
const ERC721WithERC2981Mock = artifacts.require('ERC721WithERC2981Mock');
const ERC1155WithERC2981Mock = artifacts.require('ERC1155WithERC2981Mock');
const ERC1155Mock = artifacts.require('ERC1155Mock');
const ERC20Mock = artifacts.require('ERC20Mock');
const EmptyContractMock = artifacts.require('EmptyContractMock');
const MockThatOnlySupports165 = artifacts.require('MockThatOnlySupports165');
const ERC721WithoutOwnerMock = artifacts.require('ERC721WithoutOwnerMock');
const ERC1155WithoutOwnerMock = artifacts.require('ERC1155WithoutOwnerMock');
const MarketplaceMock = artifacts.require('MarketplaceMock');

const {
  BN, // Big Number support
  constants, // Common constants, like the zero address and largest integers
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers');

const Web3 = require('web3');
const web3 = new Web3('http://localhost:8545');
const fromWei = web3.utils.fromWei;
const toWei = web3.utils.toWei;

const NFTType = {
  ERC721: '0',
  ERC721_2981: '1',
  ERC1155: '2',
  ERC1155_2981: '3',
};

let protocolFeeNumerator = new web3.utils.BN('2500000000000'); //Numerator of the protocol fee
let protocolFeeDenominator = new web3.utils.BN('100000000000000'); //Denominator of the protocol fee

const truffleAssert = require('truffle-assertions');
const { time } = require('@openzeppelin/test-helpers');
const fs = require('fs');
var assert = require('assert');
const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants');
const { eventEmitted } = require('truffle-assertions');

const { calcFunds, listingStructToObject, listItem } = require('./utils.js');

contract('Royalties', async (accounts) => {
  const addrOwner = accounts[0];
  const addrNotOwner = accounts[1];

  const addrSeller1 = accounts[2];
  const addrBuyer1 = accounts[3];

  const addrSeller2 = accounts[4];
  const addrBuyer2 = accounts[5];

  let marketplace;
  let marketplaceProxy;

  let erc721;
  let erc721with2981;

  let erc1155with2981;
  let erc1155;

  let erc721withoutOwner;
  let erc1155withoutOwner;


  let erc20;

  beforeEach(async () => {
    marketplace = await Marketplace.new();
    marketplaceProxy = await MarketplaceProxy.new(marketplace.address);
    marketplace = await Marketplace.at(marketplaceProxy.address);
 

    erc721 = await ERC721Mock.new();
    erc721with2981 = await ERC721WithERC2981Mock.new();
    erc721withoutOwner = await ERC721WithoutOwnerMock.new();

    erc1155 = await ERC1155Mock.new();
    erc1155with2981 = await ERC1155WithERC2981Mock.new();
    erc1155withoutOwner = await ERC1155WithoutOwnerMock.new();
    erc20 = await ERC20Mock.new();


    // Mints tokenId=1

    let erc721TokenId = await erc721.mint(addrSeller1, {
      from: addrSeller1,
    });

    let erc721with2981TokenId = await erc721with2981.mint(addrSeller1, {
      from: addrSeller1,
    });

    let erc1155TokenId = await erc1155.mint(addrSeller1, {
      from: addrSeller1,
    });

    let erc1155with2981TokenId = await erc1155with2981.mint(addrSeller1, {
      from: addrSeller1,
    });

    await erc721withoutOwner.mint(addrSeller1, {
      from: addrSeller1,
    });

    await erc1155withoutOwner.mint(addrSeller1, {
      from: addrSeller1,
    });
    // For some reason we don't get back the correct tokenId, rather an Object with tx, receipt etc.

    await marketplace.addPaymentToken(erc20.address);

    // this pause is here to ensure that each test starts at xx:xx:00:00:00
    // when working with time based tests, this help prevent drag
    // while (new Date().getMilliseconds() !== 0) { }
  });

  it('can list ERC721 with ERC291 with ERC20', async () => {
    let nftAddress = await erc721with2981.address;
    let tokenId = 1;
    let price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;

    await erc721with2981.setApprovalForAll(marketplace.address, true, {
      from: addrSeller1,
    });

    let { listing, lstPtr } = await listItem(
      marketplace,
      nftAddress,
      tokenId,
      price,
      paymentToken,
      addrSeller1
    );

    let actualListing = listing.slice(0, 7);

    let expectedListing = [
      lstPtr.toString(), //listPtr
      erc721with2981.address, //nftAddress
      `${tokenId}`, //tokenId
      addrSeller1, //seller
      price.toString(), //price
      paymentToken, //paymentToken
      NFTType['ERC721_2981'], //nftType
    ];
    assert.deepStrictEqual(actualListing, expectedListing, 'listing looks as expected');
  });

  it('royalties should be correctly set on the marketplace for 721 with 2981', async () => {
    let nftAddress = await erc721with2981.address;
    let tokenId = 1;
    let price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;

    await erc721with2981.setApprovalForAll(marketplace.address, true, {
      from: addrSeller1,
    });

    let { listing, lstPtr } = await listItem(
      marketplace,
      nftAddress,
      tokenId,
      price,
      paymentToken,
      addrSeller1
    );

    let marketplaceRoyaltyInfo = await marketplace.getRoyalties(nftAddress, tokenId);

    let marketplaceReceiver = marketplaceRoyaltyInfo[0];
    let marketplaceRoyaltyAmount = marketplaceRoyaltyInfo[1];

    const nftRoyaltyInfo = await erc721with2981.royaltyInfo(tokenId, price);

    let nftReceiver = nftRoyaltyInfo[0];
    let nftRoyaltyAmount = nftRoyaltyInfo[1];

    assert.strictEqual(
      marketplaceReceiver,
      nftReceiver,
      'marketplace receiver is equal to nft receiver'
    );
    assert.strictEqual(
      marketplaceRoyaltyAmount.toString(),
      nftRoyaltyAmount.toString(),
      'marketplace royalty amount is equal to nft royalty amount'
    );
  });

  it('royalties should be correctly set on the marketplace for 1155 with 2981', async () => {
    let nftAddress = await erc1155with2981.address;
    let tokenId = 1;
    let price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;

    await erc1155with2981.setApprovalForAll(marketplace.address, true, {
      from: addrSeller1,
    });

    let { listing, lstPtr } = await listItem(
      marketplace,
      nftAddress,
      tokenId,
      price,
      paymentToken,
      addrSeller1
    );

    let marketplaceRoyaltyInfo = await marketplace.getRoyalties(nftAddress, tokenId);

    let marketplaceReceiver = marketplaceRoyaltyInfo[0];
    let marketplaceRoyaltyAmount = marketplaceRoyaltyInfo[1];

    const nftRoyaltyInfo = await erc1155with2981.royaltyInfo(tokenId, price);

    let nftReceiver = nftRoyaltyInfo[0];
    let nftRoyaltyAmount = nftRoyaltyInfo[1];

    assert.strictEqual(
      marketplaceReceiver,
      nftReceiver,
      'marketplace receiver is equal to nft receiver'
    );
    assert.strictEqual(
      marketplaceRoyaltyAmount.toString(),
      nftRoyaltyAmount.toString(),
      'marketplace royalty amount is equal to nft royalty amount'
    );
  });

  it('2891 set royalties should update based on NFTs royalties for 721', async () => {
    // even the receiver shouldn't be able to change the royalty amount for
    // a 2981 listed on the marketplace, we should just update what the NFT 2981 says

    let nftAddress = await erc721with2981.address;
    let tokenId = 1;
    let price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;

    await erc721with2981.setApprovalForAll(marketplace.address, true, {
      from: addrSeller1,
    });

    let { listing, lstPtr } = await listItem(
      marketplace,
      nftAddress,
      tokenId,
      price,
      paymentToken,
      addrSeller1
    );

    let oldMarketplaceRoyaltyInfo = await marketplace.getRoyalties(nftAddress, tokenId);
    let marketplaceReceiver = oldMarketplaceRoyaltyInfo[0];
    let marketplaceRoyaltyAmount = oldMarketplaceRoyaltyInfo[1];

    const nftRoyaltyInfo = await erc721with2981.royaltyInfo(tokenId, price);

    let nftReceiver = nftRoyaltyInfo[0];
    let nftRoyaltyAmount = nftRoyaltyInfo[1];

    assert.strictEqual(
      marketplaceReceiver,
      nftReceiver,
      'marketplace receiver is equal to nft receiver'
    );
    assert.strictEqual(
      marketplaceRoyaltyAmount.toString(),
      nftRoyaltyAmount.toString(),
      'marketplace royalty amount is equal to nft royalty amount'
    );

    // addrNotOwner should be able to set the royalties yet, as he is not the receiver
    await expectRevert(
      marketplace. updateRoyaltyAmount(nftAddress, tokenId, 0, { from: addrNotOwner }),
      'Only royalty receiver'
    );

    // update royalty receiver
    await erc721with2981.setRoyalties(addrNotOwner, { from: addrOwner });
    await marketplace. updateRoyaltyAmount(nftAddress, tokenId, 0, { from: addrOwner });

    let newMarketplaceRoyaltyInfo = await marketplace.getRoyalties(nftAddress, tokenId);

    let newMarketplaceReceiver = newMarketplaceRoyaltyInfo[0];
    let newMarketplaceRoyaltyAmount = newMarketplaceRoyaltyInfo[1];

    assert.strictEqual(
      newMarketplaceReceiver,
      addrNotOwner,
      'marketplace receiver is equal to nft receiver'
    );
    assert.strictEqual(
      newMarketplaceRoyaltyAmount.toString(),
      nftRoyaltyAmount.toString(),
      'marketplace royalty amount is equal to nft royalty amount'
    );
  });

  it('2891 set royalties should update based on NFTs royalties for 1155', async () => {
    // even the receiver shouldn't be able to change the royalty amount for
    // a 2981 listed on the marketplace, we should just update what the NFT 2981 says

    let nftAddress = await erc1155with2981.address;
    let tokenId = 1;
    let price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;

    await erc1155with2981.setApprovalForAll(marketplace.address, true, {
      from: addrSeller1,
    });

    let { listing, lstPtr } = await listItem(
      marketplace,
      nftAddress,
      tokenId,
      price,
      paymentToken,
      addrSeller1
    );

    let oldMarketplaceRoyaltyInfo = await marketplace.getRoyalties(nftAddress, tokenId);
    let marketplaceReceiver = oldMarketplaceRoyaltyInfo[0];
    let marketplaceRoyaltyAmount = oldMarketplaceRoyaltyInfo[1];

    const nftRoyaltyInfo = await erc1155with2981.royaltyInfo(tokenId, price);

    let nftReceiver = nftRoyaltyInfo[0];
    let nftRoyaltyAmount = nftRoyaltyInfo[1];

    assert.strictEqual(
      marketplaceReceiver,
      nftReceiver,
      'marketplace receiver is equal to nft receiver'
    );
    assert.strictEqual(
      marketplaceRoyaltyAmount.toString(),
      nftRoyaltyAmount.toString(),
      'marketplace royalty amount is equal to nft royalty amount'
    );

    // addrNotOwner should be able to set the royalties yet, as he is not the receiver
    await expectRevert(
      marketplace. updateRoyaltyAmount(nftAddress, tokenId, 0, { from: addrNotOwner }),
      'Only royalty receiver'
    );

    // update royalty receiver
    await erc1155with2981.setRoyalties(addrNotOwner, { from: addrOwner });
    await marketplace. updateRoyaltyAmount(nftAddress, tokenId, 0, { from: addrOwner });

    let newMarketplaceRoyaltyInfo = await marketplace.getRoyalties(nftAddress, tokenId);

    let newMarketplaceReceiver = newMarketplaceRoyaltyInfo[0];
    let newMarketplaceRoyaltyAmount = newMarketplaceRoyaltyInfo[1];

    assert.strictEqual(
      newMarketplaceReceiver,
      addrNotOwner,
      'marketplace receiver is equal to nft receiver'
    );
    assert.strictEqual(
      newMarketplaceRoyaltyAmount.toString(),
      nftRoyaltyAmount.toString(),
      'marketplace royalty amount is equal to nft royalty amount'
    );
  });

  it('can update royalties if you are the owner for 721 when not 2981', async () => {
    let nftAddress = await erc721.address;
    let tokenId = 1;
    let price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;

    await erc721.setApprovalForAll(marketplace.address, true, {
      from: addrSeller1,
    });

    let { listing, lstPtr } = await listItem(
      marketplace,
      nftAddress,
      tokenId,
      price,
      paymentToken,
      addrSeller1
    );

    assert.strictEqual(
      listing.price,
      price,
      'listing price is equal to price'
    );

    let marketplaceRoyaltyInfo = await marketplace.getRoyalties(nftAddress, tokenId);

    let marketplaceReceiver = marketplaceRoyaltyInfo[0];
    let marketplaceRoyaltyAmount = marketplaceRoyaltyInfo[1];
    
    assert.strictEqual(
      marketplaceReceiver,
      addrOwner,
      "marketplace receiver is equal to owner"
    );

    assert.strictEqual(
      marketplaceRoyaltyAmount.toString(),
      "0",
      "marketplace royalty amount is equal to 0"
    );

    let newRoyaltyAmount = web3.utils.toWei('0.001', 'ether');
    let newPrice = new BN(price).add(new BN(newRoyaltyAmount));

    await expectRevert(
      marketplace. updateRoyaltyAmount(nftAddress, tokenId, newRoyaltyAmount, { from: addrNotOwner }),
      'Only royalty receiver'
    )

    await marketplace.updateRoyaltyAmount(nftAddress, tokenId, newRoyaltyAmount, { from: addrOwner });

    listing = await marketplace.getListing(nftAddress, tokenId);
    
    // As current royalty amount is 0 for a 721 with only an owner
    assert.strictEqual(
      listing.price.toString(),
      newPrice.toString(),
      'listing price is equal to price plus new royalty amount'
    );

    let newMarketplaceRoyaltyInfo = await marketplace.getRoyalties(nftAddress, tokenId);

    let newMarketplaceReceiver = newMarketplaceRoyaltyInfo[0];
    let newMarketplaceRoyaltyAmount = newMarketplaceRoyaltyInfo[1];

    assert.strictEqual(
      newMarketplaceReceiver,
      addrOwner,
      "marketplace receiver is equal to owner"
    );

    assert.strictEqual(
      newMarketplaceRoyaltyAmount.toString(),
      newRoyaltyAmount.toString(),
      "marketplace royalty amount is equal to new royalty amount"
    );
  });

  

  it('can update royalties if you are the owner for 1155 when not 2981', async () => {
    let nftAddress = await erc1155.address;
    let tokenId = 1;
    let price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;

    await erc1155.setApprovalForAll(marketplace.address, true, {
      from: addrSeller1,
    });

    let { listing, lstPtr } = await listItem(
      marketplace,
      nftAddress,
      tokenId,
      price,
      paymentToken,
      addrSeller1
    );

    assert.strictEqual(
      listing.price,
      price,
      'listing price is equal to price'
    );

    let marketplaceRoyaltyInfo = await marketplace.getRoyalties(nftAddress, tokenId);

    let marketplaceReceiver = marketplaceRoyaltyInfo[0];
    let marketplaceRoyaltyAmount = marketplaceRoyaltyInfo[1];
    
    assert.strictEqual(
      marketplaceReceiver,
      addrOwner,
      "marketplace receiver is equal to owner"
    );

    assert.strictEqual(
      marketplaceRoyaltyAmount.toString(),
      "0",
      "marketplace royalty amount is equal to 0"
    );

    let newRoyaltyAmount = web3.utils.toWei('0.001', 'ether');
    let newPrice = new BN(price).add(new BN(newRoyaltyAmount));

    await expectRevert(
      marketplace. updateRoyaltyAmount(nftAddress, tokenId, newRoyaltyAmount, { from: addrNotOwner }),
      'Only royalty receiver'
    )

    await marketplace.updateRoyaltyAmount(nftAddress, tokenId, newRoyaltyAmount, { from: addrOwner });

    listing = await marketplace.getListing(nftAddress, tokenId);
    
    // As current royalty amount is 0 for a 1155 with only an owner
    assert.strictEqual(
      listing.price.toString(),
      newPrice.toString(),
      'listing price is equal to price plus new royalty amount'
    );

    let newMarketplaceRoyaltyInfo = await marketplace.getRoyalties(nftAddress, tokenId);

    let newMarketplaceReceiver = newMarketplaceRoyaltyInfo[0];
    let newMarketplaceRoyaltyAmount = newMarketplaceRoyaltyInfo[1];

    assert.strictEqual(
      newMarketplaceReceiver,
      addrOwner,
      "marketplace receiver is equal to owner"
    );

    assert.strictEqual(
      newMarketplaceRoyaltyAmount.toString(),
      newRoyaltyAmount.toString(),
      "marketplace royalty amount is equal to new royalty amount"
    );
  });

  it('can not update if no owner and not 2981 for 721', async () => {
    let nftAddress = await erc721withoutOwner.address;
    let tokenId = 1;
    let price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;

    await erc721withoutOwner.setApprovalForAll(marketplace.address, true, {
      from: addrSeller1,
    });

    let { listing, lstPtr } = await listItem(
      marketplace,
      nftAddress,
      tokenId,
      price,
      paymentToken,
      addrSeller1
    );

    assert.strictEqual(
      listing.price,
      price,
      'listing price is equal to price'
    );

    let marketplaceRoyaltyInfo = await marketplace.getRoyalties(nftAddress, tokenId);

    let marketplaceReceiver = marketplaceRoyaltyInfo[0];
    let marketplaceRoyaltyAmount = marketplaceRoyaltyInfo[1];
    
    assert.strictEqual(
      marketplaceReceiver,
      ZERO_ADDRESS,
      "marketplace receiver is equal to owner"
    );

    assert.strictEqual(
      marketplaceRoyaltyAmount.toString(),
      "0",
      "marketplace royalty amount is equal to 0"
    );

    let newRoyaltyAmount = web3.utils.toWei('0.001', 'ether');

    await expectRevert(
      marketplace. updateRoyaltyAmount(nftAddress, tokenId, newRoyaltyAmount, { from: addrOwner }),
      'Token has no owner'
    );

  });

  it('can not update if no owner and not 2981 for 1155', async () => {
    let nftAddress = await erc1155withoutOwner.address;
    let tokenId = 1;
    let price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;

    await erc1155withoutOwner.setApprovalForAll(marketplace.address, true, {
      from: addrSeller1,
    });

    let { listing, lstPtr } = await listItem(
      marketplace,
      nftAddress,
      tokenId,
      price,
      paymentToken,
      addrSeller1
    );

    assert.strictEqual(
      listing.price,
      price,
      'listing price is equal to price'
    );

    let marketplaceRoyaltyInfo = await marketplace.getRoyalties(nftAddress, tokenId);

    let marketplaceReceiver = marketplaceRoyaltyInfo[0];
    let marketplaceRoyaltyAmount = marketplaceRoyaltyInfo[1];
    
    assert.strictEqual(
      marketplaceReceiver,
      ZERO_ADDRESS,
      "marketplace receiver is equal to owner"
    );

    assert.strictEqual(
      marketplaceRoyaltyAmount.toString(),
      "0",
      "marketplace royalty amount is equal to 0"
    );

    let newRoyaltyAmount = web3.utils.toWei('0.001', 'ether');

    await expectRevert(
      marketplace. updateRoyaltyAmount(nftAddress, tokenId, newRoyaltyAmount, { from: addrOwner }),
      'Token has no owner'
    );

  });

  xit('royalties set for opensea for 721', async () => {});

  xit('royalties set for opensea for 1155', async () => {});
});
