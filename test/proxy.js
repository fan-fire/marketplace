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

const listingStructToObject = require('./utils.js').listingStructToObject

const truffleAssert = require('truffle-assertions');
const { time } = require('@openzeppelin/test-helpers');
const fs = require('fs');
var assert = require('assert');
const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants');
const { eventEmitted } = require('truffle-assertions');

const listItem = require('./utils.js').listItem

const calcFunds = require('./utils.js').calcFunds


contract('Proxy', async (accounts) => {
  const addrOwner = accounts[0];
  const addrNotOwner = accounts[1];

  const addrSeller1 = accounts[2];
  const addrBuyer1 = accounts[3];

  const addrSeller2 = accounts[4];
  const addrBuyer2 = accounts[5];

  const baseURI = 'https://6nrf7eucx6al.usemoralis.com/metadata/cats-on-parade/';
  let marketplace;
  let oldMarketplace;
  let marketplaceProxy;
  let erc721;
  let erc721with2981;
  let erc1155;
  let price;
  let tokenId;
  let erc20;

  beforeEach(async () => {
    oldMarketplace = await Marketplace.new();
    marketplaceProxy = await MarketplaceProxy.new(oldMarketplace.address);
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

  it('can mint a new marketplace, update the proxy, and listings stay the same', async () => {
    let oldListings = await marketplace.getAllListings();
    let oldAddress = await marketplaceProxy.currentMarketplace();

    assert.strictEqual(
      oldMarketplace.address,
      oldAddress,
      'Old marketplace proxy address is correct'
    );

    let newMarketplace = await Marketplace.new();
    let tx = await marketplaceProxy.upgrade(newMarketplace.address);

    let newAddress = await marketplaceProxy.currentMarketplace();

    assert.strictEqual(
      newAddress,
      newMarketplace.address,
      'New marketplace proxy address is correct'
    );

    truffleAssert.eventEmitted(tx, 'Upgraded', (ev) => {
      return ev.newAddress === newMarketplace.address;
    });

    let newListings = await marketplace.getAllListings();
    assert.deepStrictEqual(newListings, oldListings, 'listings are the same');
  });

  // fails if not owner
  it("can't upgrade if not the owner", async () => {
    await expectRevert(
      marketplaceProxy.upgrade(ZERO_ADDRESS, { from: accounts[1] }),
      'Ownable: caller is not the owner'
    );
  });

  it("Can load an altered Marketplace Proxy, list another item, upgrade to an see both previous proxy's listings", async () => {
    let firstListings = await marketplace.getAllListings();
    let marketplaceMock = await MarketplaceMock.new();
    await marketplaceProxy.upgrade(marketplaceMock.address);

    marketplace = await MarketplaceMock.at(marketplaceProxy.address);

    let paymentToken = erc20.address;

    let approvedERC20 = await marketplace.isPaymentToken(erc20.address);

    assert.strictEqual(approvedERC20, true, 'ERC20 is approved');

    erc721 = await ERC721Mock.new();

    let erc721TokenId = await erc721.mint(addrSeller1, {
      from: addrSeller1,
    });

    // assert(erc721TokenId.toString() === '1', 'tokenId is 1');
    // assert(erc721with2981TokenId.toString() === '1', 'tokenId is 1');
    // assert(erc1155TokenId.toString() === '1', 'tokenId is 1');
    // assert(erc1155with2981TokenId.toString() === '1', 'tokenId is 1');

    tokenId = 1;

    await erc721.setApprovalForAll(marketplace.address, true, {
      from: addrSeller1,
    });

    let { listing, lstPtr } = await listItem(
      marketplace,
      erc721.address,
      tokenId,
      price,
      paymentToken,
      addrSeller1
    );

    let secondListings = await marketplace.getAllListings();

    assert.strictEqual(
      firstListings.length,
      secondListings.length - 1,
      'one listings added to second proxy'
    );

    // Alteration made int he Mock Contracted when list is called
    let aleterationInMock = await marketplace.stringStorage('mock');
    assert.strictEqual(aleterationInMock, 'mock', 'mock string is set');

    // overote buy method in Mock emit Log event with Mock
    let tx = await marketplace.buy(erc721.address, tokenId, {
      from: addrBuyer1,
    });
    truffleAssert.eventEmitted(tx, 'Logz', (ev) => {
      return ev.s === 'Mock buy';
    });

    let newMarketplace = await Marketplace.new();
    tx = await marketplaceProxy.upgrade(newMarketplace.address);
    marketplace = await Marketplace.at(marketplaceProxy.address);
    let newAddress = await marketplaceProxy.currentMarketplace();

    assert.strictEqual(
      newAddress,
      newMarketplace.address,
      'New marketplace proxy address is correct'
    );

    aleterationInMock = await marketplace.stringStorage('mock');
    assert.strictEqual(aleterationInMock, 'mock', 'mock added remains');

    let allListings = await marketplace.getAllListings();

    assert.strictEqual(allListings.length, secondListings.length, 'all listings are the same');

    approvedERC20 = await marketplace.isPaymentToken(erc20.address);

    assert.strictEqual(
      approvedERC20,
      true,
      'ERC20 should still be approved with normal isPaymentToken method'
    );
  });
});
