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
const calcFunds = require('./utils.js').calcFunds

const truffleAssert = require('truffle-assertions');
const { time } = require('@openzeppelin/test-helpers');
const fs = require('fs');
var assert = require('assert');
const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants');
const { eventEmitted } = require('truffle-assertions');

const listItem = require('./utils.js').listItem

contract('Protocol Fees', async (accounts) => {
  const addrOwner = accounts[0];

  const addrSeller1 = accounts[2];
  const addrBuyer1 = accounts[3];

  const addrSeller2 = accounts[4];
  const addrBuyer2 = accounts[5];

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

  it('should calculate the correct "inclusive" fees for no artist fees', async () => {
    var price = new web3.utils.BN('1000');
    var artistAmount = web3.utils.toWei('0', 'ether');
    protocolFeeDenominator = new web3.utils.BN('1000');
    protocolFeeNumerator = new web3.utils.BN('25');
    var method = 'inclusive';

    let { artistAmountBN, protocolFeeBN, sellerAmountBN, buyerAmountBN } = calcFunds(
      price,
      artistAmount,
      protocolFeeDenominator,
      protocolFeeNumerator,
      method
    );

    let expectedBuyerAmount = price;
    let expectedArtistAmount = new web3.utils.BN('0');
    // var price =            new web3.utils.BN('1000000000000000000');
    let expectedProtocolFee = new web3.utils.BN('25');
    let expectedSellerAmount = new web3.utils.BN('975');

    assert.equal(artistAmountBN.toString(), expectedArtistAmount.toString());
    assert.equal(sellerAmountBN.toString(), expectedSellerAmount.toString());
    assert.equal(buyerAmountBN.toString(), expectedBuyerAmount.toString());
    assert.equal(protocolFeeBN.toString(), expectedProtocolFee.toString());
  });

  it('should calculate the correct "inclusive" fees for artist fees', async () => {
    var price = new web3.utils.BN('1000');
    var artistAmount = new web3.utils.BN('100');
    protocolFeeDenominator = new web3.utils.BN('1000');
    protocolFeeNumerator = new web3.utils.BN('25');
    var method = 'inclusive';

    let { artistAmountBN, protocolFeeBN, sellerAmountBN, buyerAmountBN } = calcFunds(
      price,
      artistAmount,
      protocolFeeDenominator,
      protocolFeeNumerator,
      method
    );

    let expectedBuyerAmount = price;
    let expectedArtistAmount = new web3.utils.BN('100');
    let expectedProtocolFee = new web3.utils.BN('25');
    let expectedSellerAmount = new web3.utils.BN('875');

    assert.equal(artistAmountBN.toString(), expectedArtistAmount.toString());
    assert.equal(sellerAmountBN.toString(), expectedSellerAmount.toString());
    assert.equal(buyerAmountBN.toString(), expectedBuyerAmount.toString());
    assert.equal(protocolFeeBN.toString(), expectedProtocolFee.toString());
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

  // protocol wallet get increased by the correct amount

  // protocol wallet can extract the funds from ERC20 contract after pulling the funds from the protocol wallet

  // only owner can update the protocol wallet
  it('only owner can update the protocol wallet', async () => {
    let newProtocolWallet = accounts[1];
    let curProtoWallet = await marketplace.protocolWallet();

    assert.strictEqual(
      curProtoWallet,
      addrOwner,
      'addrOwner should be the current protocol wallet'
    );
    await marketplace.changeProtocolWallet(newProtocolWallet, {
      from: addrOwner,
    });

    curProtoWallet = await marketplace.protocolWallet();
    assert.strictEqual(
      curProtoWallet,
      newProtocolWallet,
      'newProtocolWallet should be the current protocol wallet'
    );

    await expectRevert(
      marketplace.changeProtocolWallet(addrOwner, {
        from: addrBuyer1,
      }),
      'Ownable: caller is not the owner'
    );
  });
  // new protoocol wallet can't be zero
  it('new protocol wallet can not be the zero address', async () => {
    await expectRevert(
      marketplace.changeProtocolWallet(ZERO_ADDRESS, {
        from: addrOwner,
      }),
      '0x00 not allowed'
    );
  });

  // protocol amount is updated correctly after changing numerator and denominator
  it('protocol amount is updated correctly after changing numerator and denominator', async () => {
    let curProtocolFeeNumerator = await marketplace.protocolFeeNumerator();
    let curProtocolFeeDenominator = await marketplace.protocolFeeDenominator();
    protocolFeeNumerator = new web3.utils.BN('2500000000000'); //Numerator of the protocol fee
    protocolFeeDenominator = new web3.utils.BN('100000000000000'); //Denominator of the protocol fee

    assert.strictEqual(
      curProtocolFeeNumerator.toString(),
      protocolFeeNumerator.toString(),
      'protocolFeeNumerator should be the current protocol fee numerator'
    );
    assert.strictEqual(
      curProtocolFeeDenominator.toString(),
      protocolFeeDenominator.toString(),
      'protocolFeeDenominator should be the current protocol fee denominator'
    );

    let newProtocolFeeNumerator = new web3.utils.BN('100');
    let newProtocolFeeDenominator = new web3.utils.BN('1000');

    await marketplace.changeProtocolFee(newProtocolFeeNumerator, newProtocolFeeDenominator, {
      from: addrOwner,
    });

    let actualProtocolFeeNumerator = await marketplace.protocolFeeNumerator();
    let actualProtocolFeeDenominator = await marketplace.protocolFeeDenominator();

    assert.strictEqual(
      actualProtocolFeeNumerator.toString(),
      newProtocolFeeNumerator.toString(),
      'newProtocolFeeNumerator should be the current protocol fee numerator'
    );
    assert.strictEqual(
      actualProtocolFeeDenominator.toString(),
      newProtocolFeeDenominator.toString(),
      'newProtocolFeeDenominator should be the current protocol fee denominator'
    );
  });

  // numerator can't be zero
  it('denominator can not be zero', async () => {
    await expectRevert(
      marketplace.changeProtocolFee(protocolFeeNumerator, 0, {
        from: addrOwner,
      }),
      'denominator cannot be 0'
    );
  });

  // event is emitted when the protocol wallet is updated
  it('event is emitted when the protocol wallet is updated', async () => {
    let newProtocolWallet = accounts[1];
    let curProtoWallet = await marketplace.protocolWallet();

    let tx = await marketplace.changeProtocolWallet(newProtocolWallet, {
      from: addrOwner,
    });

    truffleAssert.eventEmitted(tx, 'ProtocolWalletChanged', (ev) => {
      return ev.newProtocolWallet === newProtocolWallet;
    });
  });

  // event is emmited when the protocol fee changes
  it('event is emitted when the protocol fee changed', async () => {
    let newProtocolFeeNumerator = 100;
    let newProtocolFeeDenominator = 2;

    let tx = await marketplace.changeProtocolFee(
      newProtocolFeeNumerator,
      newProtocolFeeDenominator,
      {
        from: addrOwner,
      }
    );

    truffleAssert.eventEmitted(tx, 'ProtocolFeeChanged', (ev) => {
      return (
        ev.newProtocolFeeNumerator.toString() === newProtocolFeeNumerator.toString() &&
        ev.newProtocolFeeDenominator.toString() === newProtocolFeeDenominator.toString()
      );
    });
  });
});
