const Marketplace = artifacts.require('Marketplace');
const MarketplaceProxy = artifacts.require('MarketplaceProxy');
const ERC721Mock = artifacts.require('ERC721Mock');
const ERC721WithERC2981Mock = artifacts.require('ERC721WithERC2981Mock');
const ERC1155WithERC2981Mock = artifacts.require('ERC1155WithERC2981Mock');
const ERC1155Mock = artifacts.require('ERC1155Mock');
const ERC20Mock = artifacts.require('ERC20Mock');

const {
  BN, // Big Number support
  constants, // Common constants, like the zero address and largest integers
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers');

const Web3 = require('web3');
const web3 = new Web3('http://localhost:8545');
const RESERVER_ROLE = web3.utils.soliditySha3('RESERVER_ROLE');
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

const { listItem, calcFunds, listingStructToObject } = require('./utils.js');
const truffleAssert = require('truffle-assertions');
const { time } = require('@openzeppelin/test-helpers');
const fs = require('fs');
const assert = require('assert');
const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants');
const { eventEmitted } = require('truffle-assertions');

contract('Marketplace', async (accounts) => {
  const addrOwner = accounts[0];
  const addrNotOwner = accounts[1];

  const addrSeller1 = accounts[2];
  const addrBuyer1 = accounts[3];

  const addrSeller2 = accounts[4];
  const addrBuyer2 = accounts[5];
  const addrReserver = accounts[6];

  // contracts
  let marketplace;
  let marketplaceProxy;
  let erc721;
  let erc721with2981;
  let erc1155with2981;
  let erc1155;
  let erc20;

  beforeEach(async () => {
    marketplace = await Marketplace.new();
    marketplaceProxy = await MarketplaceProxy.new(marketplace.address);
    marketplace = await Marketplace.at(marketplaceProxy.address);

    erc721 = await ERC721Mock.new();
    erc721with2981 = await ERC721WithERC2981Mock.new();
    erc1155 = await ERC1155Mock.new();
    erc1155with2981 = await ERC1155WithERC2981Mock.new();
    erc20 = await ERC20Mock.new();

    // Mints tokenId=1

    await erc721.mint(addrSeller1, {
      from: addrSeller1,
    });

    await erc721with2981.mint(addrSeller1, {
      from: addrSeller1,
    });

    await erc1155.mint(addrSeller1, {
      from: addrSeller1,
    });

    await erc1155with2981.mint(addrSeller1, {
      from: addrSeller1,
    });
    // For some reason we don't get back the correct tokenId, rather an Object with tx, receipt etc.

    await marketplace.addPaymentToken(erc20.address);

    // this pause is here to ensure that each test starts at xx:xx:00:00:00
    // when working with time based tests, this help prevent drag
    // while (new Date().getMilliseconds() !== 0) { }
  });

  it("can't list 0x00 address for payment token", async () => {
    await expectRevert(marketplace.addPaymentToken(ZERO_ADDRESS), '0x00 not allowed');
  });

  // only the seller can unlist
  it('only the seller can unlist 721', async () => {
    let nftAddress = await erc721.address;
    tokenId = 1;
    price = web3.utils.toWei('1', 'ether');
    paymentToken = erc20.address;

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

    let marketPlacePtr = await marketplace.getListingPointer(nftAddress, tokenId);

    assert.equal(marketPlacePtr.toString(), lstPtr.toString(), 'listing pointer is not correct');

    await expectRevert(
      marketplace.unlist(nftAddress, tokenId, {
        from: addrBuyer1,
      }),
      'Only seller of NFT can unlist'
    );

    let isListed = await marketplace.isListed(nftAddress, tokenId);
    assert.equal(isListed, true, 'NFT should be listed');

    await marketplace.unlist(nftAddress, tokenId, {
      from: addrSeller1,
    });

    isListed = await marketplace.isListed(nftAddress, tokenId);
    assert.equal(isListed, false, 'NFT should not be listed');
  });

  it('only the seller can unlist 1155', async () => {
    let nftAddress = await erc1155.address;
    tokenId = 1;
    price = web3.utils.toWei('1', 'ether');
    paymentToken = erc20.address;

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

    let marketPlacePtr = await marketplace.getListingPointer(nftAddress, tokenId);

    assert.equal(marketPlacePtr.toString(), lstPtr.toString(), 'listing pointer is not correct');

    await expectRevert(
      marketplace.unlist(nftAddress, tokenId, {
        from: addrBuyer1,
      }),
      'Only seller of NFT can unlist'
    );

    let isListed = await marketplace.isListed(nftAddress, tokenId);
    assert.equal(isListed, true, 'NFT should be listed');

    await marketplace.unlist(nftAddress, tokenId, {
      from: addrSeller1,
    });

    isListed = await marketplace.isListed(nftAddress, tokenId);
    assert.equal(isListed, false, 'NFT should not be listed');
  });

  //   can get the correct balance for a given token using getBalance
  it('can get the correct marketplace balance for a given address', async () => {
    erc721 = await ERC721Mock.new();
    let nftAddress = await erc721.address;
    price = web3.utils.toWei('1', 'ether');
    paymentToken = erc20.address;

    await erc20.transfer(addrBuyer1, web3.utils.toWei('10', 'ether'), {
      from: addrOwner,
    });

    // mints tokenId 1
    await erc721.mint(addrSeller1, {
      from: addrSeller1,
    });

    // mints tokenId 2
    await erc721.mint(addrSeller1, {
      from: addrSeller1,
    });
    // mints tokenId 3
    await erc721.mint(addrSeller1, {
      from: addrSeller1,
    });
    // mints tokenId 4
    await erc721.mint(addrSeller1, {
      from: addrSeller1,
    });

    await erc20.approve(marketplace.address, web3.utils.toWei('10', 'ether'), {
      from: addrBuyer1,
    });

    await erc721.setApprovalForAll(marketplace.address, true, {
      from: addrSeller1,
    });

    for (let i = 1; i <= 4; i++) {
      await listItem(marketplace, nftAddress, i, price, paymentToken, addrSeller1);
    }

    let originalBalance = await marketplace.getBalance(erc20.address, addrSeller1);
    assert.equal(originalBalance.toString(), '0', 'balance of addrSeller should be 0 at start');

    for (let i = 1; i <= 4; i++) {
      await marketplace.buy(nftAddress, new BN(i), {
        from: addrBuyer1,
      });
    }

    let newBalance = await marketplace.getBalance(erc20.address, addrSeller1);

    artistAmount = 0;

    method = 'inclusive';
    let { artistAmountBN, protocolFeeBN, sellerAmountBN, buyerAmountBN } = calcFunds(
      price,
      artistAmount,
      protocolFeeDenominator,
      protocolFeeNumerator,
      method
    );

    let expectedBalance = new BN(originalBalance)
      .add(new BN(web3.utils.toWei('4', 'ether')))
      .sub(new BN(protocolFeeBN))
      .sub(new BN(protocolFeeBN))
      .sub(new BN(protocolFeeBN))
      .sub(new BN(protocolFeeBN));

    assert.equal(
      newBalance.toString(),
      expectedBalance.toString(),
      'balance of addrSeller should be original, plus 4 sales, minus protocol fees'
    );
  });

  // can pull funds for erc20 correctly using pullFunds
  it('can pull funds for erc20 correctly', async () => {
    erc721 = await ERC721Mock.new();
    let nftAddress = await erc721.address;
    tokenId = 1;
    price = web3.utils.toWei('1', 'ether');
    paymentToken = erc20.address;

    await erc20.transfer(addrBuyer1, web3.utils.toWei('10', 'ether'), {
      from: addrOwner,
    });

    // mints tokenId 1
    await erc721.mint(addrSeller1, {
      from: addrSeller1,
    });

    await erc20.approve(marketplace.address, web3.utils.toWei('10', 'ether'), {
      from: addrBuyer1,
    });

    await erc721.setApprovalForAll(marketplace.address, true, {
      from: addrSeller1,
    });

    let originalBalance = await marketplace.getBalance(erc20.address, addrSeller1);

    await listItem(marketplace, nftAddress, tokenId, price, paymentToken, addrSeller1);

    await marketplace.buy(nftAddress, tokenId, {
      from: addrBuyer1,
    });

    let newBalance = await marketplace.getBalance(erc20.address, addrSeller1);

    artistAmount = 0;

    method = 'inclusive';
    let { artistAmountBN, protocolFeeBN, sellerAmountBN, buyerAmountBN } = calcFunds(
      price,
      artistAmount,
      protocolFeeDenominator,
      protocolFeeNumerator,
      method
    );

    let expectedBalance = new BN(originalBalance).add(new BN(price)).sub(new BN(protocolFeeBN));

    assert.equal(
      newBalance.toString(),
      expectedBalance.toString(),
      'balance of addrSeller should be original, plus 1 sale, minus protocol fees'
    );

    let erc20Balance = await erc20.balanceOf(addrSeller1);

    assert.equal(
      erc20Balance.toString(),
      '0',
      'ERC20 balance of addrSeller should be 0 before pulling funds'
    );

    // unction pullFunds(address paymentToken, uint256 amount)
    await marketplace.pullFunds(erc20.address, newBalance, {
      from: addrSeller1,
    });

    erc20Balance = await erc20.balanceOf(addrSeller1);

    assert.equal(
      erc20Balance.toString(),
      newBalance.toString(),
      'ERC20 balance of addrSeller should be newBalance after pulling funds'
    );
  });

  it('fails if no pullFunds available', async () => {
    let balance = await marketplace.getBalance(erc20.address, addrSeller1, {
      from: addrSeller1,
    });

    assert.equal(balance.toString(), '0', 'balance should be 0');

    await expectRevert(
      marketplace.pullFunds(erc20.address, new BN('1'), {
        from: addrSeller1,
      }),
      'Insufficient funds'
    );
  });

  it('pullFunds fails if erc20 token not added supported', async () => {
    erc20 = await ERC20Mock.new();

    await expectRevert(
      marketplace.pullFunds(erc20.address, new BN('1'), {
        from: addrSeller1,
      }),
      'Payment token not supported'
    );
  });

  it('pullFunds fail if amount is 0', async () => {
    await expectRevert(
      marketplace.pullFunds(erc20.address, new BN('0'), {
        from: addrSeller1,
      }),
      'Amount must be greater than 0'
    );
  });

  // can add ERC20 correctly using addPaymentToken
  it('can add ERC20 for payment token correctly', async () => {
    erc20 = await ERC20Mock.new();

    let isPaymentToken = await marketplace.isPaymentToken(erc20.address);
    assert.equal(isPaymentToken, false, 'erc20 should not be a payment token');

    await marketplace.addPaymentToken(erc20.address);

    isPaymentToken = await marketplace.isPaymentToken(erc20.address);
    assert.equal(isPaymentToken, true, 'erc20 should be a payment token');
  });

  xit("front runner can't withdraw funds", async () => {});

  it('getListingPointer works as expected', async () => {
    erc721 = await ERC721Mock.new();
    let nftAddress = await erc721.address;
    price = web3.utils.toWei('1', 'ether');
    paymentToken = erc20.address;

    await erc20.transfer(addrBuyer1, web3.utils.toWei('10', 'ether'), {
      from: addrOwner,
    });

    // mints tokenId 1
    await erc721.mint(addrSeller1, {
      from: addrSeller1,
    });

    // mints tokenId 2
    await erc721.mint(addrSeller1, {
      from: addrSeller1,
    });
    // mints tokenId 3
    await erc721.mint(addrSeller1, {
      from: addrSeller1,
    });
    // mints tokenId 4
    await erc721.mint(addrSeller1, {
      from: addrSeller1,
    });

    await erc20.approve(marketplace.address, web3.utils.toWei('10', 'ether'), {
      from: addrBuyer1,
    });

    await erc721.setApprovalForAll(marketplace.address, true, {
      from: addrSeller1,
    });

    for (let i = 1; i <= 4; i++) {
      await listItem(marketplace, nftAddress, i, price, paymentToken, addrSeller1);
    }

    let listingPointers = [];

    for (let i = 1; i <= 4; i++) {
      listingPointers.push(await marketplace.getListingPointer(nftAddress, i));
    }

    assert.equal(listingPointers[0].toString(), '0', 'listingPointer should be 0');
    assert.equal(listingPointers[1].toString(), '1', 'listingPointer should be 1');
    assert.equal(listingPointers[2].toString(), '2', 'listingPointer should be 2');
    assert.equal(listingPointers[3].toString(), '3', 'listingPointer should be 3');

    await marketplace.buy(nftAddress, 1, {
      from: addrBuyer1,
    });

    listingPointers = [];

    for (let j = 2; j <= 4; j++) {
      listingPointers.push(await marketplace.getListingPointer(nftAddress, j));
    }

    assert.equal(listingPointers[0].toString(), '1', 'listingPointer for token 2 should be 1');
    assert.equal(listingPointers[1].toString(), '2', 'listingPointer for token 3 should be 2');
    assert.equal(listingPointers[2].toString(), '0', 'listingPointer for token 4 should be 0');

    await marketplace.unlist(nftAddress, 2, {
      from: addrSeller1,
    });

    listingPointers = [];

    for (let j = 3; j <= 4; j++) {
      listingPointers.push(await marketplace.getListingPointer(nftAddress, j));
    }

    assert.equal(listingPointers[0].toString(), '1', 'listingPointer for token 3 should be 1');
    assert.equal(listingPointers[1].toString(), '0', 'listingPointer for token 4 should be 0');

    await marketplace.buy(nftAddress, 3, {
      from: addrBuyer1,
    });

    listingPointers = [];

    for (let j = 4; j <= 4; j++) {
      listingPointers.push(await marketplace.getListingPointer(nftAddress, j));
    }

    assert.equal(listingPointers[0].toString(), '0', 'listingPointer for token 4 should be 0');
  });

  it('isListed works as expected', async () => {
    erc721 = await ERC721Mock.new();
    let nftAddress = await erc721.address;
    price = web3.utils.toWei('1', 'ether');
    paymentToken = erc20.address;

    await erc20.transfer(addrBuyer1, web3.utils.toWei('10', 'ether'), {
      from: addrOwner,
    });

    // mints tokenId 1
    await erc721.mint(addrSeller1, {
      from: addrSeller1,
    });

    // mints tokenId 2
    await erc721.mint(addrSeller1, {
      from: addrSeller1,
    });
    // mints tokenId 3
    await erc721.mint(addrSeller1, {
      from: addrSeller1,
    });
    // mints tokenId 4
    await erc721.mint(addrSeller1, {
      from: addrSeller1,
    });

    await erc20.approve(marketplace.address, web3.utils.toWei('10', 'ether'), {
      from: addrBuyer1,
    });

    await erc721.setApprovalForAll(marketplace.address, true, {
      from: addrSeller1,
    });

    for (let i = 1; i <= 4; i++) {
      await listItem(marketplace, nftAddress, i, price, paymentToken, addrSeller1);
    }

    let isListeds = [];

    for (let i = 1; i <= 4; i++) {
      isListeds.push(await marketplace.isListed(nftAddress, i));
    }

    assert.equal(isListeds[0], true, 'token 1 should be listed');
    assert.equal(isListeds[1], true, 'token 2 should be listed');
    assert.equal(isListeds[2], true, 'token 3 should be listed');
    assert.equal(isListeds[3], true, 'token 4 should be listed');

    await marketplace.buy(nftAddress, 1, {
      from: addrBuyer1,
    });

    isListeds = [];

    for (let i = 1; i <= 4; i++) {
      isListeds.push(await marketplace.isListed(nftAddress, i));
    }

    assert.equal(isListeds[0], false, 'token 1 should not be listed');
    assert.equal(isListeds[1], true, 'token 2 should be listed');
    assert.equal(isListeds[2], true, 'token 3 should be listed');
    assert.equal(isListeds[3], true, 'token 4 should be listed');

    await marketplace.unlist(nftAddress, 2, {
      from: addrSeller1,
    });

    isListeds = [];

    for (let i = 1; i <= 4; i++) {
      isListeds.push(await marketplace.isListed(nftAddress, i));
    }

    assert.equal(isListeds[0], false, 'token 1 should not be listed');
    assert.equal(isListeds[1], false, 'token 2 should not be listed');
    assert.equal(isListeds[2], true, 'token 3 should be listed');
    assert.equal(isListeds[3], true, 'token 4 should be listed');

    await marketplace.buy(nftAddress, 3, {
      from: addrBuyer1,
    });

    isListeds = [];

    for (let i = 1; i <= 4; i++) {
      isListeds.push(await marketplace.isListed(nftAddress, i));
    }

    assert.equal(isListeds[0], false, 'token 1 should not be listed');
    assert.equal(isListeds[1], false, 'token 2 should not be listed');
    assert.equal(isListeds[2], false, 'token 3 should not be listed');
    assert.equal(isListeds[3], true, 'token 4 should be listed');
  });

  it('getListingByPointer works as expected', async () => {
    erc721 = await ERC721Mock.new();
    let nftAddress = await erc721.address;
    price = web3.utils.toWei('1', 'ether');
    paymentToken = erc20.address;

    await erc20.transfer(addrBuyer1, web3.utils.toWei('10', 'ether'), {
      from: addrOwner,
    });

    // mints tokenId 1
    await erc721.mint(addrSeller1, {
      from: addrSeller1,
    });

    // mints tokenId 2
    await erc721.mint(addrSeller1, {
      from: addrSeller1,
    });
    // mints tokenId 3
    await erc721.mint(addrSeller1, {
      from: addrSeller1,
    });
    // mints tokenId 4
    await erc721.mint(addrSeller1, {
      from: addrSeller1,
    });

    await erc20.approve(marketplace.address, web3.utils.toWei('10', 'ether'), {
      from: addrBuyer1,
    });

    await erc721.setApprovalForAll(marketplace.address, true, {
      from: addrSeller1,
    });

    for (let i = 1; i <= 4; i++) {
      await listItem(marketplace, nftAddress, i, price, paymentToken, addrSeller1);
    }

    let listingsByPointer = [];

    for (let i = 0; i <= 3; i++) {
      listingsByPointer.push(await marketplace.getListingByPointer(i));
    }

    listingsByPointer = listingsByPointer.map((listing) => listingStructToObject(listing));

    assert.equal(
      listingsByPointer[0].tokenId.toString(),
      '1',
      'token 1 should be at listingPointer 0'
    );
    assert.equal(
      listingsByPointer[1].tokenId.toString(),
      '2',
      'token 2 should be at listingPointer 1'
    );
    assert.equal(
      listingsByPointer[2].tokenId.toString(),
      '3',
      'token 3 should be at listingPointer 2'
    );
    assert.equal(
      listingsByPointer[3].tokenId.toString(),
      '4',
      'token 4 should be at listingPointer 3'
    );

    await marketplace.buy(nftAddress, 1, {
      from: addrBuyer1,
    });

    listingsByPointer = [];

    for (let i = 0; i <= 2; i++) {
      listingsByPointer.push(await marketplace.getListingByPointer(i));
    }

    listingsByPointer = listingsByPointer.map((listing) => listingStructToObject(listing));

    assert.equal(
      listingsByPointer[0].tokenId.toString(),
      '4',
      'token 4 should be at listingPointer 0'
    );
    assert.equal(
      listingsByPointer[1].tokenId.toString(),
      '2',
      'token 2 should be at listingPointer 1'
    );
    assert.equal(
      listingsByPointer[2].tokenId.toString(),
      '3',
      'token 3 should be at listingPointer 2'
    );

    await marketplace.unlist(nftAddress, 2, {
      from: addrSeller1,
    });

    listingsByPointer = [];

    for (let i = 0; i <= 1; i++) {
      listingsByPointer.push(await marketplace.getListingByPointer(i));
    }

    listingsByPointer = listingsByPointer.map((listing) => listingStructToObject(listing));

    assert.equal(
      listingsByPointer[0].tokenId.toString(),
      '4',
      'token 4 should be at listingPointer 0'
    );
    assert.equal(
      listingsByPointer[1].tokenId.toString(),
      '3',
      'token 3 should be at listingPointer 1'
    );

    await marketplace.unlist(nftAddress, 3, {
      from: addrSeller1,
    });

    listingsByPointer = [];

    for (let i = 0; i <= 0; i++) {
      listingsByPointer.push(await marketplace.getListingByPointer(i));
    }

    listingsByPointer = listingsByPointer.map((listing) => listingStructToObject(listing));

    assert.equal(
      listingsByPointer[0].tokenId.toString(),
      '4',
      'token 4 should be at listingPointer 0'
    );
  });

  it("can't unlistStale if token is still owned and approved by seller or buyer", async () => {
    let nftAddress = await erc721.address;
    price = web3.utils.toWei('1', 'ether');
    paymentToken = erc20.address;
    tokenId = 1;

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

    await marketplace.unlistStale(nftAddress, tokenId, {
      from: addrSeller1,
    });

    let listingAfterUnlist = await marketplace.getListingByPointer(lstPtr);

    assert.deepStrictEqual(
      listingStructToObject(listing),
      listingStructToObject(listingAfterUnlist),
      'listing should not be unlisted'
    );
  });

  it("can't unlist if token is reserved", async () => {
    let nftAddress = await erc721.address;
    price = web3.utils.toWei('1', 'ether');
    paymentToken = erc20.address;
    tokenId = 1;

    await erc721.setApprovalForAll(marketplace.address, true, {
      from: addrSeller1,
    });

    let { l, lstPtr } = await listItem(
      marketplace,
      nftAddress,
      tokenId,
      price,
      paymentToken,
      addrSeller1
    );

    await marketplace.grantRole(RESERVER_ROLE, addrReserver);

    let period = 300 * 60; //period is seconds
    let reservee = addrBuyer2;
    await marketplace.reserve(nftAddress, tokenId, period, reservee, { from: addrReserver });

    let listing = await marketplace.getListing(nftAddress, tokenId);
    listing = listingStructToObject(listing);

    await expectRevert(
      marketplace.unlist(nftAddress, tokenId, {
        from: addrSeller1,
      }),
      'NFT reserved'
    );
  });

  it('can unlist if token is not reserved', async () => {
    let nftAddress = await erc721.address;
    price = web3.utils.toWei('1', 'ether');
    paymentToken = erc20.address;
    tokenId = 1;

    await erc721.setApprovalForAll(marketplace.address, true, {
      from: addrSeller1,
    });

    let { l, lstPtr } = await listItem(
      marketplace,
      nftAddress,
      tokenId,
      price,
      paymentToken,
      addrSeller1
    );

    await marketplace.unlist(nftAddress, tokenId, {
      from: addrSeller1,
    });

    await expectRevert(marketplace.getListing(nftAddress, tokenId), 'NFT not listed');
  });

  it('can unlist if reserved time has passed', async () => {
    let nftAddress = await erc721.address;
    price = web3.utils.toWei('1', 'ether');
    paymentToken = erc20.address;
    tokenId = 1;

    await erc721.setApprovalForAll(marketplace.address, true, {
      from: addrSeller1,
    });

    let { l, lstPtr } = await listItem(
      marketplace,
      nftAddress,
      tokenId,
      price,
      paymentToken,
      addrSeller1
    );

    await marketplace.grantRole(RESERVER_ROLE, addrReserver);

    let period = 300 * 60; //period is seconds
    let reservee = addrBuyer2;
    await marketplace.reserve(nftAddress, tokenId, period, reservee, { from: addrReserver });

    await time.increase(period);

    await marketplace.unlist(nftAddress, tokenId, {
      from: addrSeller1,
    });

    await expectRevert(marketplace.getListing(nftAddress, tokenId), 'NFT not listed');
  });

  it('getReservedState resturns correct state', async () => {
    let nftAddress = await erc721.address;
    price = web3.utils.toWei('1', 'ether');
    paymentToken = erc20.address;
    tokenId = 1;

    await erc721.setApprovalForAll(marketplace.address, true, {
      from: addrSeller1,
    });

    let { l, lstPtr } = await listItem(
      marketplace,
      nftAddress,
      tokenId,
      price,
      paymentToken,
      addrSeller1
    );

    await marketplace.grantRole(RESERVER_ROLE, addrReserver);

    let period = 300 * 60; //period is seconds
    let reservee = addrBuyer2;
    await marketplace.reserve(nftAddress, tokenId, period, reservee, { from: addrReserver });

    let now = await time.latest();
    let reservedState = await marketplace.getReservedState(nftAddress, tokenId);
    let expectedReservedUntil = new BN(now).add(new BN(period));
    let expectedReservedState = {
      reservedFor: '0x911E06d05DC610E07C39D20cb240b20c0fF075B5',
      reservedUntil: expectedReservedUntil.toString(),
    };

    reservedState = {
      reservedFor: reservedState['reservedFor'],
      reservedUntil: reservedState['reservedUntil'].toString(),
    };

    assert.deepStrictEqual(
      reservedState,
      expectedReservedState,
      'reserved state should be correct'
    );
  });
});
