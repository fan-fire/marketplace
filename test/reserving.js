const Marketplace = artifacts.require('Marketplace');
const MarketplaceProxy = artifacts.require('MarketplaceProxy');
const ERC721Mock = artifacts.require('ERC721Mock');
const ERC721WithERC2981Mock = artifacts.require('ERC721WithERC2981Mock');
const ERC1155WithERC2981Mock = artifacts.require('ERC1155WithERC2981Mock');
const ERC1155Mock = artifacts.require('ERC1155Mock');
const ERC20Mock = artifacts.require('ERC20Mock');

const {
  BN, // Big Number support
  expectRevert, // Assertions for transactions that should fail
  time, // Time helpers
} = require('@openzeppelin/test-helpers');

const Web3 = require('web3');
const web3 = new Web3('http://localhost:8545');

const RESERVER_ROLE = web3.utils.soliditySha3('RESERVER_ROLE');

const {listingStructToObject,listItem} = require('./utils.js');
const assert = require('assert');
const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants');

contract('Reserving', async (accounts) => {
  const addrOwner = accounts[0];

  const addrSeller1 = accounts[2];
  const addrBuyer1 = accounts[3];
  const addrBuyer2 = accounts[5];

  const addrReserver = accounts[6];
  let marketplace;
  let marketplaceProxy;
  let erc721;
  let erc721with2981;
  let erc1155;
  let price;
  let tokenId;
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

    await erc20.transfer(addrBuyer1, web3.utils.toWei('10', 'ether'), {
      from: addrOwner,
    });

    await erc20.transfer(addrBuyer2, web3.utils.toWei('10', 'ether'), {
      from: addrOwner,
    });

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

    // assert(erc721TokenId.toString() === '1', 'tokenId is 1');
    // assert(erc721with2981TokenId.toString() === '1', 'tokenId is 1');
    // assert(erc1155TokenId.toString() === '1', 'tokenId is 1');
    // assert(erc1155with2981TokenId.toString() === '1', 'tokenId is 1');

    tokenId = 1;

    await erc721.setApprovalForAll(marketplace.address, true, {
      from: addrSeller1,
    });

    await erc721with2981.setApprovalForAll(marketplace.address, true, {
      from: addrSeller1,
    });

    await erc1155.setApprovalForAll(marketplace.address, true, {
      from: addrSeller1,
    });

    await erc1155with2981.setApprovalForAll(marketplace.address, true, {
      from: addrSeller1,
    });

    let nftAddresses = [
      erc721with2981.address,
      erc1155with2981.address,
      erc721.address,
      erc1155.address,
    ];
    price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;

    for (let i = 0; i < nftAddresses.length; i++) {
      nftAddress = nftAddresses[i];

      let { listing, lstPtr } = await listItem(
        marketplace,
        nftAddress,
        tokenId,
        price,
        paymentToken,
        addrSeller1
      );
    }
  });

  it('addrSeller1 is the owner of all 4 NFTs set up in before each', async () => {
    // Confirm that addrSeller1 is the owner of all 4 NFTs' tokenId 1
    erc721OwnerOf1 = await erc721.ownerOf(1);
    erc721with2981OwnerOf1 = await erc721with2981.ownerOf(1);
    erc1155OwnerOf1 = await erc1155.balanceOf(addrSeller1, 1);
    erc1155with2981OwnerOf1 = await erc1155with2981.balanceOf(addrSeller1, 1);

    assert.strictEqual(erc721OwnerOf1, addrSeller1);
    assert.strictEqual(erc721with2981OwnerOf1, addrSeller1);
    assert.strictEqual(erc1155OwnerOf1.toString(), '1');
    assert.strictEqual(erc1155with2981OwnerOf1.toString(), '1');
  });

  it('can buy 721 if not reserved', async () => {
    let nftAddress = erc721.address;
    let tokenId = 1;
    let paymentToken = erc20.address;
    let price = web3.utils.toWei('1', 'ether');

    let listing = await marketplace.getListing(nftAddress, tokenId);
    listing = listingStructToObject(listing);

    assert.strictEqual(
      listing.reservedUntil.toString(),
      '0',
      'ReservedUntil is 0 if no reserving is set'
    );
    assert.strictEqual(
      listing.reservedFor,
      ZERO_ADDRESS,
      'ReservedBy is 0x0000000000000000000000000000000000000000 if no reserving is set'
    );

    await erc20.approve(marketplace.address, price, {
      from: addrBuyer1,
    });

    await marketplace.buy(nftAddress, tokenId, {
      from: addrBuyer1,
    });

    let erc721OwnerOf1 = await erc721.ownerOf(1);

    assert.strictEqual(erc721OwnerOf1, addrBuyer1);
  });

  it('can buy 1155 if not reserved', async () => {
    let nftAddress = erc1155.address;
    let tokenId = 1;
    let paymentToken = erc20.address;
    let price = web3.utils.toWei('1', 'ether');

    let listing = await marketplace.getListing(nftAddress, tokenId);
    listing = listingStructToObject(listing);

    assert.strictEqual(
      listing.reservedUntil.toString(),
      '0',
      'ReservedUntil is 0 if no reserving is set'
    );
    assert.strictEqual(
      listing.reservedFor,
      ZERO_ADDRESS,
      'ReservedBy is 0x0000000000000000000000000000000000000000 if no reserving is set'
    );

    await erc20.approve(marketplace.address, price, {
      from: addrBuyer1,
    });

    await marketplace.buy(nftAddress, tokenId, {
      from: addrBuyer1,
    });

    let erc1155OwnerOf1 = await erc1155.balanceOf(addrBuyer1, 1);

    assert.strictEqual(erc1155OwnerOf1.toString(), '1');
  });

  it("can't buy 721 if reserved", async () => {
    let nftAddress = erc721.address;
    let tokenId = 1;
    let paymentToken = erc20.address;
    let price = web3.utils.toWei('1', 'ether');

    await marketplace.grantRole(RESERVER_ROLE, addrReserver);

    let listing = await marketplace.getListing(nftAddress, tokenId);
    listing = listingStructToObject(listing);

    assert.strictEqual(
      listing.reservedUntil.toString(),
      '0',
      'ReservedUntil is 0 if no reserving is set'
    );
    assert.strictEqual(
      listing.reservedFor,
      ZERO_ADDRESS,
      'ReservedBy is 0x0000000000000000000000000000000000000000 if no reserving is set'
    );

    let period = 300 * 60; //period is seconds
    let reservee = addrBuyer2;
    await marketplace.reserve(nftAddress, tokenId, period, reservee, { from: addrReserver });

    listing = await marketplace.getListing(nftAddress, tokenId);
    listing = listingStructToObject(listing);
    let now = await time.latest();

    let expectedReservedUntil = new BN(now).add(new BN(period));

    assert.strictEqual(
      listing.reservedUntil.toString(),
      expectedReservedUntil.toString(),
      'ReservedUntil is set to now + period'
    );
    assert.strictEqual(listing.reservedFor, reservee, 'ReservedBy is set to addrReserver');

    await expectRevert(
      marketplace.buy(nftAddress, tokenId, {
        from: addrBuyer1,
      }),
      'NFT reserved for another account'
    );
  });

  it("can't buy 1155 if reserved", async () => {
    let nftAddress = erc1155.address;
    let tokenId = 1;
    let paymentToken = erc20.address;
    let price = web3.utils.toWei('1', 'ether');

    await marketplace.grantRole(RESERVER_ROLE, addrReserver);

    hasAddrReserverRole = await marketplace.hasRole(RESERVER_ROLE, addrReserver);

    assert.strictEqual(
      hasAddrReserverRole,
      true,
      'addrReserver should now have the role RESERVER_ROLE'
    );

    let listing = await marketplace.getListing(nftAddress, tokenId);
    listing = listingStructToObject(listing);

    assert.strictEqual(
      listing.reservedUntil.toString(),
      '0',
      'ReservedUntil is 0 if no reserving is set'
    );
    assert.strictEqual(
      listing.reservedFor,
      ZERO_ADDRESS,
      'ReservedBy is 0x0000000000000000000000000000000000000000 if no reserving is set'
    );

    let period = 300 * 60; //period is seconds
    let reservee = addrBuyer2;
    await marketplace.reserve(nftAddress, tokenId, period, reservee, { from: addrReserver });

    listing = await marketplace.getListing(nftAddress, tokenId);
    listing = listingStructToObject(listing);
    let now = await time.latest();

    let expectedReservedUntil = new BN(now).add(new BN(period));

    assert.strictEqual(
      listing.reservedUntil.toString(),
      expectedReservedUntil.toString(),
      'ReservedUntil is set to now + period'
    );
    assert.strictEqual(listing.reservedFor, reservee, 'ReservedBy is set to addrReserver');

    await expectRevert(
      marketplace.buy(nftAddress, tokenId, {
        from: addrBuyer1,
      }),
      'NFT reserved for another account'
    );
  });

  it('can buy 721 if reserved with reservedFor account', async () => {
    let nftAddress = erc721.address;
    let tokenId = 1;
    let paymentToken = erc20.address;
    let price = web3.utils.toWei('1', 'ether');
    await marketplace.grantRole(RESERVER_ROLE, addrReserver);

    let period = 300 * 60; //period is seconds
    let reservee = addrBuyer2;
    await marketplace.reserve(nftAddress, tokenId, period, reservee, { from: addrReserver });

    await erc20.approve(marketplace.address, price, {
      from: addrBuyer2,
    });

    await marketplace.buy(nftAddress, tokenId, {
      from: addrBuyer2,
    });

    let erc721OwnerOf1 = await erc721.ownerOf(1);

    assert.strictEqual(erc721OwnerOf1, addrBuyer2);
  });

  it('can buy 1155 if reserved with reservedFor account', async () => {
    let nftAddress = erc1155.address;
    let tokenId = 1;
    let paymentToken = erc20.address;
    let price = web3.utils.toWei('1', 'ether');

    await marketplace.grantRole(RESERVER_ROLE, addrReserver);

    let period = 300 * 60; //period is seconds
    let reservee = addrBuyer2;
    await marketplace.reserve(nftAddress, tokenId, period, reservee, { from: addrReserver });

    await erc20.approve(marketplace.address, price, {
      from: addrBuyer2,
    });

    await marketplace.buy(nftAddress, tokenId, {
      from: addrBuyer2,
    });

    let erc1155OwnerOf1 = await erc1155.balanceOf(addrBuyer2, 1);
    assert.strictEqual(erc1155OwnerOf1.toString(), '1');
  });

  it('can buy 721 if reserved with any account if reserve period has passed', async () => {
    let nftAddress = erc721.address;
    let tokenId = 1;
    let paymentToken = erc20.address;
    let price = web3.utils.toWei('1', 'ether');
    await marketplace.grantRole(RESERVER_ROLE, addrReserver);

    let period = 300 * 60; //period is seconds
    let reservee = addrBuyer2;
    await marketplace.reserve(nftAddress, tokenId, period, reservee, { from: addrReserver });

    await time.increase(period);
    await erc20.approve(marketplace.address, price, {
      from: addrBuyer1,
    });

    await marketplace.buy(nftAddress, tokenId, {
      from: addrBuyer1,
    });

    let erc721OwnerOf1 = await erc721.ownerOf(1);

    assert.strictEqual(erc721OwnerOf1, addrBuyer1);
  });

  it('can buy 1155 if reserved with any account if reserve period has passed', async () => {
    let nftAddress = erc1155.address;
    let tokenId = 1;
    let paymentToken = erc20.address;
    let price = web3.utils.toWei('1', 'ether');
    await marketplace.grantRole(RESERVER_ROLE, addrReserver);

    let period = 300 * 60; //period is seconds
    let reservee = addrBuyer2;
    await marketplace.reserve(nftAddress, tokenId, period, reservee, { from: addrReserver });

    await time.increase(period);
    await erc20.approve(marketplace.address, price, {
      from: addrBuyer1,
    });

    await marketplace.buy(nftAddress, tokenId, {
      from: addrBuyer1,
    });

    let erc1155OwnerOf1 = await erc1155.balanceOf(addrBuyer1, 1);
    assert.strictEqual(erc1155OwnerOf1.toString(), '1');
  });

  it("fails if you don't have rerver role", async () => {
    let hasAddrReserverRole = await marketplace.hasRole(RESERVER_ROLE, addrReserver);

    assert.strictEqual(
      hasAddrReserverRole,
      false,
      "addrReserver doens't have the role RESERVER_ROLE yet"
    );

    let lowerCaseAddrReserver = addrReserver.toLowerCase();

    await expectRevert(
      marketplace.reserve(nftAddress, tokenId, 300 * 60, addrBuyer2, {
        from: addrReserver,
      }),
      `AccessControl: account ${lowerCaseAddrReserver} is missing role ${RESERVER_ROLE} -- Reason given: AccessControl: account ${lowerCaseAddrReserver} is missing role ${RESERVER_ROLE}.`
    );
  });

  it("can't set period greater than MAX_RESERVE_PERIOD", async () => {
    //1 day in seconds
    let MAX_RESERVE_PERIOD = 60 * 60 * 24;
    await marketplace.grantRole(RESERVER_ROLE, addrReserver);

    await expectRevert(
      marketplace.reserve(nftAddress, tokenId, MAX_RESERVE_PERIOD + 1, addrBuyer2, {
        from: addrReserver,
      }),
      'Invalid period'
    );
  });
});
