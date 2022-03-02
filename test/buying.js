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

const truffleAssert = require('truffle-assertions');
const { time } = require('@openzeppelin/test-helpers');
const fs = require('fs');
var assert = require('assert');
const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants');
const { eventEmitted } = require('truffle-assertions');

const listItem = require('./utils.js').listItem;

const calcFunds = require('./utils.js').calcFunds;

contract('Buying', async (accounts) => {
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

  it('4 listings look as expected', async () => {
    let expectedListings = [
      {
        listPtr: '0',
        nftAddress: erc721with2981.address,
        tokenId: '1',
        seller: addrSeller1,
        price: price,
        paymentToken: erc20.address,
        nftType: NFTType['ERC721_2981'],
        reservedFor: ZERO_ADDRESS,
        reservedUntil: 0,
      },
      {
        listPtr: '1',
        nftAddress: erc1155with2981.address,
        tokenId: '1',
        seller: addrSeller1,
        price: price,
        paymentToken: erc20.address,
        nftType: NFTType['ERC1155_2981'],
        reservedFor: ZERO_ADDRESS,
        reservedUntil: 0,
      },
      {
        listPtr: '2',
        nftAddress: erc721.address,
        tokenId: '1',
        seller: addrSeller1,
        price: price,
        paymentToken: erc20.address,
        nftType: NFTType['ERC721'],
        reservedFor: ZERO_ADDRESS,
        reservedUntil: 0,
      },
      {
        listPtr: '3',
        nftAddress: erc1155.address,
        tokenId: '1',
        seller: addrSeller1,
        price: price,
        paymentToken: erc20.address,
        nftType: NFTType['ERC1155'],
        reservedFor: ZERO_ADDRESS,
        reservedUntil: 0,
      },
    ];

    let listings = await marketplace.getAllListings();

    listings = listings.map((listing) => listingStructToObject(listing));

    assert.deepEqual(listings, expectedListings);
  });

  it('buyer 1 and buyer 2 should both have 10 ether of erc20', async () => {
    let buyer1Balance = await erc20.balanceOf(addrBuyer1);
    let buyer2Balance = await erc20.balanceOf(addrBuyer2);

    assert.strictEqual(buyer1Balance.toString(), web3.utils.toWei('10', 'ether'));
    assert.strictEqual(buyer2Balance.toString(), web3.utils.toWei('10', 'ether'));
  });

  it('can buy ERC721 using ERC20', async () => {
    let nftAddress = await erc721.address;
    tokenId = 1;
    price = web3.utils.toWei('1', 'ether');
    paymentToken = erc20.address;

    let oldAddrBuyer1ERC20Balance = await erc20.balanceOf(addrBuyer1);

    assert.strictEqual(oldAddrBuyer1ERC20Balance.toString(), web3.utils.toWei('10', 'ether'));

    await erc20.approve(marketplace.address, price, {
      from: addrBuyer1,
    });

    let marketplaceAllowance = await erc20.allowance(addrBuyer1, marketplace.address);
    assert.strictEqual(marketplaceAllowance.toString(), price.toString());

    await marketplace.buy(nftAddress, tokenId, {
      from: addrBuyer1,
    });

    let artistAmount = new web3.utils.BN('0'); //beacause no ERC2981 for token
    let method = 'inclusive';

    let { artistAmountBN, protocolFeeBN, sellerAmountBN, buyerAmountBN } = calcFunds(
      price,
      artistAmount,
      protocolFeeDenominator,
      protocolFeeNumerator,
      method
    );

    // Checking buyer balance subtracted correct after purchase
    let newAddrBuyer1ERC20Balance = await erc20.balanceOf(addrBuyer1);
    assert.strictEqual(
      newAddrBuyer1ERC20Balance.toString(),
      oldAddrBuyer1ERC20Balance.sub(buyerAmountBN).toString(),
      'Buyer balance should be correct after purchase'
    );

    // Checking marketplace balance added correct after purchase
    let expectedMarketplaceBalance = artistAmountBN.add(protocolFeeBN).add(sellerAmountBN);
    let marketplaceERC20Balance = await erc20.balanceOf(marketplace.address);
    assert.strictEqual(
      marketplaceERC20Balance.toString(),
      expectedMarketplaceBalance.toString(),
      'Marketplace balance should be correct after purchase'
    );

    let sellerBalanceInMarketplace = await marketplace.getBalance(erc20.address, addrSeller1);
    let buyerBalanceInMarketplace = await marketplace.getBalance(erc20.address, addrBuyer1);
    let protocolWalletBalanceInMarketplace = await marketplace.getBalance(erc20.address, addrOwner);
    let artistBalanceInMarketplace = await marketplace.getBalance(erc20.address, addrSeller1);

    let expectedSellerBalanceInMarketplace = sellerAmountBN;
    let expectedBuyerBalanceInMarketplace = new web3.utils.BN('0');
    let expectedProtocolWalletBalanceInMarketplace = protocolFeeBN;

    assert.strictEqual(
      sellerBalanceInMarketplace.toString(),
      expectedSellerBalanceInMarketplace.toString(),
      'Seller balance in marketplace should be correct after purchase'
    );

    assert.strictEqual(
      buyerBalanceInMarketplace.toString(),
      expectedBuyerBalanceInMarketplace.toString(),
      'Buyer balance in marketplace should be correct after purchase'
    );

    assert.strictEqual(
      protocolWalletBalanceInMarketplace.toString(),
      expectedProtocolWalletBalanceInMarketplace.toString(),
      'Protocol wallet balance in marketplace should be correct after purchase'
    );

    // Not testing this here as the addrSeller is the artist
    // assert.strictEqual(
    //   artistBalanceInMarketplace.toString(),
    //   artistAmountBN.toString(),
    //   'Artist balance in marketplace should be correct after purchase'
    // );
  });

  it('can buy ERC1155 using ERC20', async () => {
    let nftAddress = await erc1155.address;
    tokenId = 1;
    price = web3.utils.toWei('1', 'ether');
    paymentToken = erc20.address;

    let oldAddrBuyer1ERC20Balance = await erc20.balanceOf(addrBuyer1);

    assert.strictEqual(oldAddrBuyer1ERC20Balance.toString(), web3.utils.toWei('10', 'ether'));

    await erc20.approve(marketplace.address, price, {
      from: addrBuyer1,
    });

    let marketplaceAllowance = await erc20.allowance(addrBuyer1, marketplace.address);
    assert.strictEqual(marketplaceAllowance.toString(), price.toString());

    await marketplace.buy(nftAddress, tokenId, {
      from: addrBuyer1,
    });

    let artistAmount = new web3.utils.BN('0'); //beacause no ERC2981 for token
    let method = 'inclusive';

    let { artistAmountBN, protocolFeeBN, sellerAmountBN, buyerAmountBN } = calcFunds(
      price,
      artistAmount,
      protocolFeeDenominator,
      protocolFeeNumerator,
      method
    );

    // Checking buyer balance subtracted correct after purchase
    let newAddrBuyer1ERC20Balance = await erc20.balanceOf(addrBuyer1);
    assert.strictEqual(
      newAddrBuyer1ERC20Balance.toString(),
      oldAddrBuyer1ERC20Balance.sub(buyerAmountBN).toString(),
      'Buyer balance should be correct after purchase'
    );

    // Checking marketplace balance added correct after purchase
    let expectedMarketplaceBalance = artistAmountBN.add(protocolFeeBN).add(sellerAmountBN);
    let marketplaceERC20Balance = await erc20.balanceOf(marketplace.address);
    assert.strictEqual(
      marketplaceERC20Balance.toString(),
      expectedMarketplaceBalance.toString(),
      'Marketplace balance should be correct after purchase'
    );

    let sellerBalanceInMarketplace = await marketplace.getBalance(erc20.address, addrSeller1);
    let buyerBalanceInMarketplace = await marketplace.getBalance(erc20.address, addrBuyer1);
    let protocolWalletBalanceInMarketplace = await marketplace.getBalance(erc20.address, addrOwner);
    let artistBalanceInMarketplace = await marketplace.getBalance(erc20.address, addrSeller1);

    let expectedSellerBalanceInMarketplace = sellerAmountBN;
    let expectedBuyerBalanceInMarketplace = new web3.utils.BN('0');
    let expectedProtocolWalletBalanceInMarketplace = protocolFeeBN;

    assert.strictEqual(
      sellerBalanceInMarketplace.toString(),
      expectedSellerBalanceInMarketplace.toString(),
      'Seller balance in marketplace should be correct after purchase'
    );

    assert.strictEqual(
      buyerBalanceInMarketplace.toString(),
      expectedBuyerBalanceInMarketplace.toString(),
      'Buyer balance in marketplace should be correct after purchase'
    );

    assert.strictEqual(
      protocolWalletBalanceInMarketplace.toString(),
      expectedProtocolWalletBalanceInMarketplace.toString(),
      'Protocol wallet balance in marketplace should be correct after purchase'
    );

    // Not testing this here as the addrSeller is the artist
    // assert.strictEqual(
    //   artistBalanceInMarketplace.toString(),
    //   artistAmountBN.toString(),
    //   'Artist balance in marketplace should be correct after purchase'
    // );
  });

  it('can buy ERC721_2981 using ERC20', async () => {
    let nftAddress = await erc721with2981.address;
    tokenId = 1;
    price = web3.utils.toWei('1', 'ether');
    paymentToken = erc20.address;

    let protocolWallet = accounts[4];
    await marketplace.changeProtocolWallet(protocolWallet, {
      from: addrOwner,
    });

    let royalties = await erc721with2981.royaltyInfo(tokenId, price);

    let receiver = royalties['receiver'];
    let royaltyAmount = royalties['royaltyAmount'].toString();

    assert.strictEqual(royaltyAmount, web3.utils.toWei('0.1', 'ether'));

    let oldAddrBuyer1ERC20Balance = await erc20.balanceOf(addrBuyer1);

    assert.strictEqual(
      oldAddrBuyer1ERC20Balance.toString(),
      web3.utils.toWei('10', 'ether'),
      'addrBuyer1 should have 10 ether'
    );

    await erc20.approve(marketplace.address, price, {
      from: addrBuyer1,
    });

    let marketplaceAllowance = await erc20.allowance(addrBuyer1, marketplace.address);
    assert.strictEqual(marketplaceAllowance.toString(), price.toString(), 'marketplaceAllowance');

    let oldSellerBalance = await erc20.balanceOf(addrSeller1);
    let oldArtistBalance = await erc20.balanceOf(receiver);

    await marketplace.buy(nftAddress, tokenId, {
      from: addrBuyer1,
    });

    let artistAmount = royaltyAmount;
    let method = 'inclusive';

    let { artistAmountBN, protocolFeeBN, sellerAmountBN, buyerAmountBN } = calcFunds(
      price,
      artistAmount,
      protocolFeeDenominator,
      protocolFeeNumerator,
      method
    );
    let addrBuyer1ERC20Balance = await erc20.balanceOf(addrBuyer1);
    let exepectedAddrBuyer1ERC20Balance = oldAddrBuyer1ERC20Balance.sub(buyerAmountBN);

    assert.strictEqual(
      addrBuyer1ERC20Balance.toString(), //10
      exepectedAddrBuyer1ERC20Balance.toString(), //9
      'Buyer balance should be correct after purchase'
    );

    let sellerBalanceInMarketplace = await marketplace.getBalance(erc20.address, addrSeller1);
    let buyerBalanceInMarketplace = await marketplace.getBalance(erc20.address, addrBuyer1);
    let protocolWalletBalanceInMarketplace = await marketplace.getBalance(
      erc20.address,
      protocolWallet
    );
    let artistBalanceInMarketplace = await marketplace.getBalance(erc20.address, receiver);

    let expectedSellerBalanceInMarketplace = sellerAmountBN;
    let expectedBuyerBalanceInMarketplace = new web3.utils.BN('0');
    let expectedProtocolWalletBalanceInMarketplace = protocolFeeBN;
    let execptedArtistBalanceInMarketplace = artistAmountBN;

    assert.strictEqual(
      sellerBalanceInMarketplace.toString(),
      expectedSellerBalanceInMarketplace.toString(),
      'Seller balance in marketplace should be correct after purchase'
    );

    assert.strictEqual(
      buyerBalanceInMarketplace.toString(),
      expectedBuyerBalanceInMarketplace.toString(),
      'Buyer balance in marketplace should be correct after purchase'
    );

    assert.strictEqual(
      protocolWalletBalanceInMarketplace.toString(),
      expectedProtocolWalletBalanceInMarketplace.toString(),
      'Protocol wallet balance in marketplace should be correct after purchase'
    );

    assert.strictEqual(
      artistBalanceInMarketplace.toString(),
      artistAmountBN.toString(),
      'Artist balance in marketplace should be correct after purchase'
    );
  });

  it('should fail if original seller does not own the token anymore and the token is bought for ERC721', async () => {
    let erc721 = await ERC721Mock.new();
    let nftAddress = erc721.address;
    let erc721TokenId = await erc721.mint(addrSeller1, {
      from: addrSeller1,
    });

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

    let actualListing = listing.slice(0, 7);

    let expectedListing = [
      lstPtr.toString(), //listPtr
      erc721.address, //nftAddress
      `${tokenId}`, //tokenId
      addrSeller1, //seller
      price.toString(), //price
      paymentToken, //paymentToken
      NFTType['ERC721'], //nftType
    ];
    // assert.deepStrictEqual(actualListing, expectedListing, 'listing looks as expected');

    //   transferFrom(
    //     address from,
    //     address to,
    //     uint256 tokenId
    // )
    await erc721.transferFrom(addrSeller1, addrSeller2, tokenId, {
      from: addrSeller1,
    });

    // check that seller 1 is no longer the owner
    let owner = await erc721.ownerOf(tokenId);
    assert.strictEqual(owner, addrSeller2, 'owner should be addrSeller2');

    // check that item is still listed by seller 1
    let curListing = await marketplace.getListing(nftAddress, tokenId);

    assert.deepStrictEqual(
      curListing.slice(0, 7),
      expectedListing,
      'listing should still be as expected'
    );

    await erc20.approve(marketplace.address, price, {
      from: addrBuyer1,
    });

    let marketplaceAllowance = await erc20.allowance(addrBuyer1, marketplace.address);
    assert.strictEqual(marketplaceAllowance.toString(), price.toString());

    await expectRevert(
      marketplace.buy(nftAddress, tokenId, {
        from: addrBuyer1,
      }),
      'NFT not owned by seller anymore'
    );

    await marketplace.unlistStale(nftAddress, tokenId, {
      from: addrSeller1,
    });

    await expectRevert(marketplace.getListing(nftAddress, tokenId), 'NFT not listed');

    // can't buy anymore
    await expectRevert(
      marketplace.buy(nftAddress, tokenId, {
        from: addrBuyer1,
      }),
      'NFT not listed'
    );
  });

  it('should fail if original seller removed approval after listing and token is bought for ERC721', async () => {
    let erc721 = await ERC721Mock.new();
    let nftAddress = erc721.address;
    let erc721TokenId = await erc721.mint(addrSeller1, {
      from: addrSeller1,
    });

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

    let actualListing = listing.slice(0, 7);

    let expectedListing = [
      lstPtr.toString(), //listPtr
      erc721.address, //nftAddress
      `${tokenId}`, //tokenId
      addrSeller1, //seller
      price.toString(), //price
      paymentToken, //paymentToken
      NFTType['ERC721'], //nftType
    ];

    // remove the approval

    await erc721.setApprovalForAll(marketplace.address, false, {
      from: addrSeller1,
    });

    // check that the approval was removed
    let isApproved = await erc721.isApprovedForAll(addrSeller1, marketplace.address);

    assert.strictEqual(isApproved, false, 'approval should be removed');

    // check that item is still listed by seller 1
    let curListing = await marketplace.getListing(nftAddress, tokenId);

    assert.deepStrictEqual(
      curListing.slice(0, 7),
      expectedListing,
      'listing should still be as expected'
    );

    await erc20.approve(marketplace.address, price, {
      from: addrBuyer1,
    });

    let marketplaceAllowance = await erc20.allowance(addrBuyer1, marketplace.address);
    assert.strictEqual(marketplaceAllowance.toString(), price.toString());

    await expectRevert(
      marketplace.buy(nftAddress, tokenId, {
        from: addrBuyer1,
      }),
      'NFT not approved anymore'
    );

    await marketplace.unlistStale(nftAddress, tokenId, {
      from: addrSeller1,
    });

    await expectRevert(marketplace.getListing(nftAddress, tokenId), 'NFT not listed');

    // can't buy anymore
    await expectRevert(
      marketplace.buy(nftAddress, tokenId, {
        from: addrBuyer1,
      }),
      'NFT not listed'
    );
  });

  it('should fail if original seller does not own the token anymore and the token is bought for ERC1155', async () => {
    let erc1155 = await ERC1155Mock.new();
    let nftAddress = erc1155.address;
    let erc1155TokenId = await erc1155.mint(addrSeller1, {
      from: addrSeller1,
    });

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

    let actualListing = listing.slice(0, 7);

    let expectedListing = [
      lstPtr.toString(), //listPtr
      erc1155.address, //nftAddress
      `${tokenId}`, //tokenId
      addrSeller1, //seller
      price.toString(), //price
      paymentToken, //paymentToken
      NFTType['ERC1155'], //nftType
    ];
    // assert.deepStrictEqual(actualListing, expectedListing, 'listing looks as expected');

    // function safeTransferFrom(
    //   address from,
    //   address to,
    //   uint256 id,
    //   uint256 amount,
    //   bytes memory data
    await erc1155.safeTransferFrom(addrSeller1, addrSeller2, tokenId, new web3.utils.BN(1), 0x0, {
      from: addrSeller1,
    });

    let erc1155OwnerOf1 = await erc1155.balanceOf(addrSeller1, 1);
    assert.strictEqual(erc1155OwnerOf1.toString(), '0', 'addrSeller1 have 0 tokenId 1');
    erc1155OwnerOf1 = await erc1155.balanceOf(addrSeller2, 1);
    assert.strictEqual(erc1155OwnerOf1.toString(), '1', 'addrSeller2 have 1 tokenId 1');

    // check that item is still listed by seller 1
    let curListing = await marketplace.getListing(nftAddress, tokenId);

    assert.deepStrictEqual(
      curListing.slice(0, 7),
      expectedListing,
      'listing should still be as expected'
    );

    await erc20.approve(marketplace.address, price, {
      from: addrBuyer1,
    });

    let marketplaceAllowance = await erc20.allowance(addrBuyer1, marketplace.address);
    assert.strictEqual(marketplaceAllowance.toString(), price.toString());

    await expectRevert(
      marketplace.buy(nftAddress, tokenId, {
        from: addrBuyer1,
      }),
      'NFT not owned by seller anymore'
    );

    await marketplace.unlistStale(nftAddress, tokenId, {
      from: addrSeller1,
    });

    await expectRevert(marketplace.getListing(nftAddress, tokenId), 'NFT not listed');

    // can't buy anymore
    await expectRevert(
      marketplace.buy(nftAddress, tokenId, {
        from: addrBuyer1,
      }),
      'NFT not listed'
    );
  });

  it('should fail and unlist item if original seller removed the approve for ERC1155', async () => {
    let erc1155 = await ERC1155Mock.new();
    let nftAddress = erc1155.address;
    let erc1155TokenId = await erc1155.mint(addrSeller1, {
      from: addrSeller1,
    });

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

    let actualListing = listing.slice(0, 7);

    let expectedListing = [
      lstPtr.toString(), //listPtr
      erc1155.address, //nftAddress
      `${tokenId}`, //tokenId
      addrSeller1, //seller
      price.toString(), //price
      paymentToken, //paymentToken
      NFTType['ERC1155'], //nftType
    ];

    await erc1155.setApprovalForAll(marketplace.address, false, {
      from: addrSeller1,
    });

    // check that the approval was removed
    let isApproved = await erc1155.isApprovedForAll(addrSeller1, marketplace.address);

    assert.strictEqual(isApproved, false, 'approval should be removed');

    // check that item is still listed by seller 1
    let curListing = await marketplace.getListing(nftAddress, tokenId);

    assert.deepStrictEqual(
      curListing.slice(0, 7),
      expectedListing,
      'listing should still be as expected'
    );

    await erc20.approve(marketplace.address, price, {
      from: addrBuyer1,
    });

    let marketplaceAllowance = await erc20.allowance(addrBuyer1, marketplace.address);
    assert.strictEqual(marketplaceAllowance.toString(), price.toString());

    await expectRevert(
      marketplace.buy(nftAddress, tokenId, {
        from: addrBuyer1,
      }),
      'NFT not approved anymore'
    );

    await marketplace.unlistStale(nftAddress, tokenId, {
      from: addrSeller1,
    });

    await expectRevert(marketplace.getListing(nftAddress, tokenId), 'NFT not listed');

    // can't buy anymore
    await expectRevert(
      marketplace.buy(nftAddress, tokenId, {
        from: addrBuyer1,
      }),
      'NFT not listed'
    );
  });

  //   fails if NFT not listed
  xit('fails if NFT not listed', async () => {});

  // fails if buyer doens't have enough ERC20 balance
  xit("fails if buyer doens't have enough ERC20 balance", async () => {});
});
