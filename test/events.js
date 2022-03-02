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

const listingStructToObject = require('./utils.js').listingStructToObject;
const RESERVER_ROLE = web3.utils.soliditySha3('RESERVER_ROLE');

const truffleAssert = require('truffle-assertions');
const { time } = require('@openzeppelin/test-helpers');
const fs = require('fs');
var assert = require('assert');
const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants');
const { eventEmitted } = require('truffle-assertions');

const listItem = require('./utils.js').listItem;

const calcFunds = require('./utils.js').calcFunds;

contract('Events', async (accounts) => {
  const addrOwner = accounts[0];
  const addrNotOwner = accounts[1];

  const addrSeller1 = accounts[2];
  const addrBuyer1 = accounts[3];

  const addrSeller2 = accounts[4];
  const addrBuyer2 = accounts[5];

  const addrReserver = accounts[6];

  const baseURI = 'https://6nrf7eucx6al.usemoralis.com/metadata/cats-on-parade/';
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
  });

  it('should emit a Listed event correctly when listing an ERC721', async () => {
    let nftAddress = erc721.address;
    tokenId = 1;
    price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;
    let tx = await marketplace.list(nftAddress, tokenId, price, paymentToken, {
      from: addrSeller1,
    });

    truffleAssert.eventEmitted(tx, 'Listed', (ev) => {
      return (
        ev.listPtr.toString() === '0' &&
        ev.nftAddress === erc721.address &&
        ev.tokenId.toString() === '1' &&
        ev.seller === addrSeller1 &&
        ev.price.toString() === price.toString() &&
        ev.paymentToken === erc20.address &&
        ev.nftType.toString() === NFTType['ERC721'] &&
        ev.royaltyReceiver === addrOwner &&
        ev.royaltyAmount.toString() === '0'
      );
    });
  });

  it('should emit a Listed event correctly when listing an ERC1155', async () => {
    let nftAddress = erc1155.address;
    tokenId = 1;
    price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;
    let tx = await marketplace.list(nftAddress, tokenId, price, paymentToken, {
      from: addrSeller1,
    });

    truffleAssert.eventEmitted(tx, 'Listed', (ev) => {
      return (
        ev.listPtr.toString() === '0' &&
        ev.nftAddress === erc1155.address &&
        ev.tokenId.toString() === '1' &&
        ev.seller === addrSeller1 &&
        ev.price.toString() === price.toString() &&
        ev.paymentToken === erc20.address &&
        ev.nftType.toString() === NFTType['ERC1155'] &&
        ev.royaltyReceiver === addrOwner &&
        ev.royaltyAmount.toString() === '0'
      );
    });
  });

  it('should emit a Listed event correctly when listing an ERC721 With ERC2981', async () => {
    let nftAddress = erc721with2981.address;
    tokenId = 1;
    price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;
    let tx = await marketplace.list(nftAddress, tokenId, price, paymentToken, {
      from: addrSeller1,
    });

    let royaltyInfo = await erc721with2981.royaltyInfo(tokenId, price, {
      from: addrSeller1,
    });
    let receiver = royaltyInfo['receiver'];
    let royaltyAmount = royaltyInfo['royaltyAmount'];

    truffleAssert.eventEmitted(tx, 'Listed', (ev) => {
      return (
        ev.listPtr.toString() === '0' &&
        ev.nftAddress === erc721with2981.address &&
        ev.tokenId.toString() === '1' &&
        ev.seller === addrSeller1 &&
        ev.price.toString() === price.toString() &&
        ev.paymentToken === erc20.address &&
        ev.nftType.toString() === NFTType['ERC721_2981'] &&
        ev.royaltyReceiver === receiver &&
        ev.royaltyAmount.toString() === royaltyAmount.toString()
      );
    });
  });

  it('should emit a Listed event correctly when listing an ERC1155 With ERC2981', async () => {
    let nftAddress = erc1155with2981.address;
    tokenId = 1;
    price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;
    let tx = await marketplace.list(nftAddress, tokenId, price, paymentToken, {
      from: addrSeller1,
    });

    let royaltyInfo = await erc1155with2981.royaltyInfo(tokenId, price, {
      from: addrSeller1,
    });
    let receiver = royaltyInfo['receiver'];
    let royaltyAmount = royaltyInfo['royaltyAmount'];

    truffleAssert.eventEmitted(tx, 'Listed', (ev) => {
      return (
        ev.listPtr.toString() === '0' &&
        ev.nftAddress === erc1155with2981.address &&
        ev.tokenId.toString() === '1' &&
        ev.seller === addrSeller1 &&
        ev.price.toString() === price.toString() &&
        ev.paymentToken === erc20.address &&
        ev.nftType.toString() === NFTType['ERC1155_2981'] &&
        ev.royaltyReceiver === receiver &&
        ev.royaltyAmount.toString() === royaltyAmount.toString()
      );
    });
  });

  it('should emit a Bought event for ERC721 with ERC20', async () => {
    let nftAddress = erc721.address;
    tokenId = 1;
    price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;
    await marketplace.list(nftAddress, tokenId, price, paymentToken, {
      from: addrSeller1,
    });

    await erc20.approve(marketplace.address, price, {
      from: addrBuyer1,
    });

    let tx = await marketplace.buy(nftAddress, tokenId, {
      from: addrBuyer1,
    });

    truffleAssert.eventEmitted(tx, 'Bought', (ev) => {
      return (
        ev.listPtr.toString() === '0' &&
        ev.nftAddress === erc721.address &&
        ev.tokenId.toString() === '1' &&
        ev.buyer === addrBuyer1 &&
        ev.price.toString() === price.toString() &&
        ev.paymentToken === erc20.address &&
        ev.nftType.toString() === NFTType['ERC721'] &&
        ev.royaltyReceiver === addrOwner &&
        ev.royaltyAmount.toString() === '0'
      );
    });
  });

  it('should emit a Bought event for ERC1155 with ERC20', async () => {
    let nftAddress = erc1155.address;
    tokenId = 1;
    price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;
    await marketplace.list(nftAddress, tokenId, price, paymentToken, {
      from: addrSeller1,
    });

    await erc20.approve(marketplace.address, price, {
      from: addrBuyer1,
    });

    let tx = await marketplace.buy(nftAddress, tokenId, {
      from: addrBuyer1,
    });

    truffleAssert.eventEmitted(tx, 'Bought', (ev) => {
      return (
        ev.listPtr.toString() === '0' &&
        ev.nftAddress === erc1155.address &&
        ev.tokenId.toString() === '1' &&
        ev.buyer === addrBuyer1 &&
        ev.price.toString() === price.toString() &&
        ev.paymentToken === erc20.address &&
        ev.nftType.toString() === NFTType['ERC1155'] &&
        ev.royaltyReceiver === addrOwner &&
        ev.royaltyAmount.toString() === '0'
      );
    });
  });

  it('should emit a Bought event for ERC721 with ERC2891 with ERC20', async () => {
    let nftAddress = erc721with2981.address;
    tokenId = 1;
    price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;

    let royaltyInfo = await erc721with2981.royaltyInfo(tokenId, price, {
      from: addrSeller1,
    });
    let receiver = royaltyInfo['receiver'];
    let royaltyAmount = royaltyInfo['royaltyAmount'];

    await marketplace.list(nftAddress, tokenId, price, paymentToken, {
      from: addrSeller1,
    });

    await erc20.approve(marketplace.address, price, {
      from: addrBuyer1,
    });

    let tx = await marketplace.buy(nftAddress, tokenId, {
      from: addrBuyer1,
    });

    truffleAssert.eventEmitted(tx, 'Bought', (ev) => {
      return (
        ev.listPtr.toString() === '0' &&
        ev.nftAddress === erc721with2981.address &&
        ev.tokenId.toString() === '1' &&
        ev.buyer === addrBuyer1 &&
        ev.price.toString() === price.toString() &&
        ev.paymentToken === erc20.address &&
        ev.nftType.toString() === NFTType['ERC721_2981'] &&
        ev.royaltyReceiver === receiver &&
        ev.royaltyAmount.toString() === royaltyAmount.toString()
      );
    });
  });

  it('should emit a Bought event for ERC1155 with ERC2891 with ERC20', async () => {
    let nftAddress = erc1155with2981.address;
    tokenId = 1;
    price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;

    let royaltyInfo = await erc1155with2981.royaltyInfo(tokenId, price, {
      from: addrSeller1,
    });
    let receiver = royaltyInfo['receiver'];
    let royaltyAmount = royaltyInfo['royaltyAmount'];

    await marketplace.list(nftAddress, tokenId, price, paymentToken, {
      from: addrSeller1,
    });

    await erc20.approve(marketplace.address, price, {
      from: addrBuyer1,
    });

    let tx = await marketplace.buy(nftAddress, tokenId, {
      from: addrBuyer1,
    });

    truffleAssert.eventEmitted(tx, 'Bought', (ev) => {
      return (
        ev.listPtr.toString() === '0' &&
        ev.nftAddress === erc1155with2981.address &&
        ev.tokenId.toString() === '1' &&
        ev.buyer === addrBuyer1 &&
        ev.price.toString() === price.toString() &&
        ev.paymentToken === erc20.address &&
        ev.nftType.toString() === NFTType['ERC1155_2981'] &&
        ev.royaltyReceiver === receiver &&
        ev.royaltyAmount.toString() === royaltyAmount.toString()
      );
    });
  });

  it('should emit a PaymentTokenAdded event', async () => {
    erc20 = await ERC20Mock.new();
    let tx = await marketplace.addPaymentToken(erc20.address, {
      from: addrOwner,
    });

    truffleAssert.eventEmitted(tx, 'PaymentTokenAdded', (ev) => {
      return ev.paymentToken === erc20.address;
    });
  });

  it('should emit a FundsWithdrawn event for ERC20 withdrawal', async () => {
    let nftAddress = erc1155.address;
    tokenId = 1;
    price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;

    await marketplace.list(nftAddress, tokenId, price, paymentToken, {
      from: addrSeller1,
    });

    await erc20.approve(marketplace.address, price, {
      from: addrBuyer1,
    });

    await marketplace.buy(nftAddress, tokenId, {
      from: addrBuyer1,
    });

    let artistAmount = new BN(web3.utils.toWei('0', 'ether'));
    let method = 'inclusive';

    let { artistAmountBN, protocolFeeBN, sellerAmountBN, buyerAmountBN } = calcFunds(
      price,
      artistAmount,
      protocolFeeDenominator,
      protocolFeeNumerator,
      method
    );

    let sellerBalance = await marketplace.getBalance(paymentToken, addrSeller1);

    assert.strictEqual(
      sellerBalance.toString(),
      sellerAmountBN.toString(),
      'seller balance is incorrect'
    );

    // function pullFunds(address paymentToken, uint256 amount) public whenNotPaused nonReentrant {
    let tx = await marketplace.pullFunds(paymentToken, sellerAmountBN, {
      from: addrSeller1,
    });

    truffleAssert.eventEmitted(tx, 'FundsWithdrawn', (ev) => {
      return (
        ev.to === addrSeller1 &&
        ev.paymentToken === erc20.address &&
        ev.amount.toString() === sellerAmountBN.toString()
      );
    });
  });

  it('should emit a RoyaltiesSet event', async () => {
    let nftAddress = erc721.address;
    tokenId = 1;
    price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;
    await marketplace.list(nftAddress, tokenId, price, paymentToken, {
      from: addrSeller1,
    });

    let newRoyaltyAmount = web3.utils.toWei('0.2', 'ether');

    let tx = await marketplace.updateRoyaltyAmount(nftAddress, tokenId, newRoyaltyAmount);

    truffleAssert.eventEmitted(tx, 'RoyaltiesSet', (ev) => {
      return (
        ev.nftAddress === nftAddress &&
        ev.tokenId.toString() === `${tokenId}` &&
        ev.royaltyAmount.toString() === newRoyaltyAmount.toString() &&
        ev.royaltyReceiver === addrOwner
      );
    });
  });

  it('should emit a Unlisted event when unlisting', async () => {
    let nftAddress = erc721.address;
    tokenId = 1;
    price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;
    await marketplace.list(nftAddress, tokenId, price, paymentToken, {
      from: addrSeller1,
    });

    let tx = await marketplace.unlist(nftAddress, tokenId, {
      from: addrSeller1,
    });
    truffleAssert.eventEmitted(tx, 'Unlisted', (ev) => {
      return ev.nftAddress === nftAddress && ev.tokenId.toString() === `${tokenId}`;
    });
  });

  it('should emit a Unlisted event when buying', async () => {
    let nftAddress = erc721.address;
    tokenId = 1;
    price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;
    await marketplace.list(nftAddress, tokenId, price, paymentToken, {
      from: addrSeller1,
    });

    await erc20.approve(marketplace.address, price, {
      from: addrBuyer1,
    });

    let tx = await marketplace.buy(nftAddress, tokenId, {
      from: addrBuyer1,
    });
    truffleAssert.eventEmitted(tx, 'Unlisted', (ev) => {
      return ev.nftAddress === nftAddress && ev.tokenId.toString() === `${tokenId}`;
    });
  });

  it('should emit event when paused', async () => {
    let tx = await marketplace.pause({
      from: addrOwner,
    });
    truffleAssert.eventEmitted(tx, 'Paused', (ev) => {
      return ev.account === addrOwner;
    });
  });

  it('should emit event when unpaused', async () => {
    await marketplace.pause({
      from: addrOwner,
    });

    let tx = await marketplace.unpause({
      from: addrOwner,
    });

    truffleAssert.eventEmitted(tx, 'Unpaused', (ev) => {
      return ev.account === addrOwner;
    });
  });

  it('should emit UnlistStale when stale NFT is unlisted', async () => {
    let nftAddress = erc721.address;
    let tokenId = 1;
    let price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;

    let { listing, lstPtr } = await listItem(
      marketplace,
      nftAddress,
      tokenId,
      price,
      paymentToken,
      addrSeller1
    );

    await erc721.setApprovalForAll(marketplace.address, false, {
      from: addrSeller1,
    });

    // event UnlistStale(address indexed nftAddress, uint256 indexed tokenId);
    //
    let tx = await marketplace.unlistStale(nftAddress, tokenId, {
      from: addrSeller1,
    });

    truffleAssert.eventEmitted(tx, 'UnlistStale', (ev) => {
      return ev.nftAddress === nftAddress && ev.tokenId.toString() === `${tokenId}`;
    });
  });

  it('should emit a RoyaltiesSet event when listing', async () => {
    let nftAddress = await erc721.address;
    let tokenId = 1;
    let price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;

    let { listing, lstPtr } = await listItem(
      marketplace,
      nftAddress,
      tokenId,
      price,
      paymentToken,
      addrSeller1
    );

    let newRoyaltyAmount = web3.utils.toWei('0.001', 'ether');

    let tx = await marketplace.updateRoyaltyAmount(nftAddress, tokenId, newRoyaltyAmount, {
      from: addrOwner,
    });

    truffleAssert.eventEmitted(tx, 'RoyaltiesSet', (ev) => {
      return (
        ev.nftAddress === nftAddress &&
        ev.tokenId.toString() === `${tokenId}` &&
        ev.royaltyAmount.toString() === newRoyaltyAmount.toString() &&
        ev.royaltyReceiver === addrOwner
      );
    });
  });

  it('should emit Reserved when token is reserved', async () => {
    let nftAddress = erc721.address;
    let tokenId = 1;
    let paymentToken = erc20.address;
    let price = web3.utils.toWei('1', 'ether');

    await listItem(marketplace, nftAddress, tokenId, price, paymentToken, addrSeller1);

    let period = 60;
    let now = await time.latest();
    let reservee = addrBuyer1;

    let expectedReservedUntil = new BN(now).add(new BN(period));
    await marketplace.grantRole(RESERVER_ROLE, addrReserver);

    let tx = await marketplace.reserve(nftAddress, tokenId, period, reservee, {
      from: addrReserver,
    });

    truffleAssert.eventEmitted(tx, 'Reserved', (ev) => {
      return (
        ev.nftAddress === nftAddress &&
        ev.tokenId.toString() === `${tokenId}` &&
        ev.reservedFor === reservee &&
        ev.reservedUntil.toString() === expectedReservedUntil.toString() &&
        ev.period.toString() === `${period}`
      );
    });
  });
});
