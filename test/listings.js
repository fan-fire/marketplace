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

const listItem = require('./utils.js').listItem;
const listingStructToObject = require('./utils.js').listingStructToObject;

contract('Listing', async (accounts) => {
  const addrOwner = accounts[0];
  const addrNotOwner = accounts[1];

  const addrSeller1 = accounts[2];
  const addrBuyer1 = accounts[3];

  const addrSeller2 = accounts[4];
  const addrBuyer2 = accounts[5];

  const baseURI = 'https://6nrf7eucx6al.usemoralis.com/metadata/cats-on-parade/';
  let marketplace;
  let marketplaceProxy;

  let erc721;
  let erc721with2981;

  let erc1155with2981;
  let erc1155;

  let erc721OwnerOf1;
  let erc721with2981OwnerOf1;
  let erc1155OwnerOf1;
  let erc1155with2981OwnerOf1;

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

    // this pause is here to ensure that each test starts at xx:xx:00:00:00
    // when working with time based tests, this help prevent drag
    // while (new Date().getMilliseconds() !== 0) { }
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

  it('can list ERC1155 with ERC291 with ERC20', async () => {
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

    let actualListing = listing.slice(0, 7);

    let expectedListing = [
      lstPtr.toString(), //listPtr
      erc1155with2981.address, //nftAddress
      `${tokenId}`, //tokenId
      addrSeller1, //seller
      price.toString(), //price
      paymentToken, //paymentToken
      NFTType['ERC1155_2981'], //nftType
    ];

    assert.deepStrictEqual(actualListing, expectedListing, 'listing looks as expected');
  });

  // fails if NFT does not support 165
  it('fails if NFT does not support 165', async () => {
    let notERC721 = await EmptyContractMock.new();
    let nftAddress = await notERC721.address;
    let tokenId = 1;
    let price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;

    await expectRevert(
      marketplace.list(nftAddress, tokenId, price, paymentToken, {
        from: addrSeller1,
      }),
      'NFT not ERC165'
    );
  });

  //   fails if nftAddress is not ERC721 or ERC1155
  it('fails if nftAddress is not ERC721 or ERC1155, but supports ERC165', async () => {
    let notERC721 = await MockThatOnlySupports165.new();

    let nftAddress = notERC721.address;
    let tokenId = 1;
    let price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;

    await expectRevert(
      marketplace.list(nftAddress, tokenId, price, paymentToken, {
        from: addrSeller1,
      }),
      'NFT not ERC721 nor ERC1155'
    );
  });

  //   fails if tokenId of ERC721 is not owned by seller
  it('fails if tokenId is not owned by seller', async () => {
    erc721OwnerOf1 = await erc721.ownerOf(1);
    let nftAddress = erc721.address;
    let tokenId = 1;
    let price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;

    assert.notEqual(erc721OwnerOf1, addrSeller2);

    await expectRevert(
      marketplace.list(nftAddress, tokenId, price, paymentToken, {
        from: addrSeller2,
      }),
      'Sender not owner'
    );
  });

  //   fails if tokenId of ERC1155 is not owned by seller
  it('fails if tokenId is not owned by seller', async () => {
    let nftAddress = erc1155.address;
    let tokenId = 1;
    let price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;
    erc1155OwnerOf1 = await erc1155.balanceOf(addrSeller2, tokenId);

    assert.strictEqual(erc1155OwnerOf1.toString(), '0');

    await expectRevert(
      marketplace.list(nftAddress, tokenId, price, paymentToken, {
        from: addrSeller2,
      }),
      'Sender not owner'
    );
  });

  //   fails if tokenId is not approved for all by seller
  it('fails if tokenId of ERC721 is not approved for all by seller', async () => {
    let nftAddress = await erc721.address;
    let tokenId = 1;
    let price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;

    await expectRevert(
      marketplace.list(nftAddress, tokenId, price, paymentToken, {
        from: addrSeller1,
      }),
      'Marketplace not approved'
    );
  });

  it('fails if tokenId of ERC1155 is not approved for all by seller', async () => {
    let nftAddress = await erc1155.address;
    let tokenId = 1;
    let price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;

    await expectRevert(
      marketplace.list(nftAddress, tokenId, price, paymentToken, {
        from: addrSeller1,
      }),
      'Marketplace not approved'
    );
  });

  //   fails if price is 0 for ERC721
  it('fails if price is 0 for ERC721', async () => {
    let nftAddress = await erc721.address;
    let tokenId = 1;
    let price = web3.utils.toWei('0', 'ether');
    let paymentToken = erc20.address;

    await erc721.setApprovalForAll(marketplace.address, true, {
      from: addrSeller1,
    });

    await expectRevert(
      marketplace.list(nftAddress, tokenId, price, paymentToken, {
        from: addrSeller1,
      }),
      'Invalid price'
    );
  });

  //   fails if price is 0 for ERC721
  it('fails if price is 0 for ERC1155', async () => {
    let nftAddress = await erc1155.address;
    let tokenId = 1;
    let price = web3.utils.toWei('0', 'ether');
    let paymentToken = erc20.address;
    await erc1155.setApprovalForAll(marketplace.address, true, {
      from: addrSeller1,
    });

    await expectRevert(
      marketplace.list(nftAddress, tokenId, price, paymentToken, {
        from: addrSeller1,
      }),
      'Invalid price'
    );
  });

  //   fails if paymentToken is not ERC20
  it('fails if paymentToken is not in approved ERC20 list', async () => {
    let notERC20 = await EmptyContractMock.new();
    let nftAddress = await erc1155.address;
    let tokenId = 1;
    let price = web3.utils.toWei('1', 'ether');
    let paymentToken = notERC20.address;
    await erc1155.setApprovalForAll(marketplace.address, true, {
      from: addrSeller1,
    });

    await expectRevert(
      marketplace.list(nftAddress, tokenId, price, paymentToken, {
        from: addrSeller1,
      }),
      'Invalid payment token'
    );
  });

  // Royalties are correctly set for ERC721 if listing supports ERC2981
  it('Royalties are correctly set for ERC721 if listing supports ERC2981', async () => {
    erc721with2981 = await ERC721WithERC2981Mock.new();
    let owner = accounts[0];
    let artist = accounts[5];
    let nftAddress = erc721with2981.address;
    let tokenId = 1;
    let price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;

    await erc721with2981.mint(addrSeller2, {
      from: owner,
    });

    ownerOfTokenId = await erc721with2981.ownerOf(tokenId);

    assert.strictEqual(ownerOfTokenId, addrSeller2, 'Owner of tokenId is not seller2');

    // get royalty info using a random account
    let royaltyInfo = await erc721with2981.royaltyInfo(tokenId, price, {
      from: addrSeller1,
    });
    let receiver = royaltyInfo['receiver'];
    let royaltyAmount = royaltyInfo['royaltyAmount'];

    assert.strictEqual(receiver, owner, 'Minter should be intial owner');

    let expectedToyaltyAmount = new BN(price).mul(new BN('10')).div(new BN('100'));
    assert.strictEqual(
      royaltyAmount.toString(),
      expectedToyaltyAmount.toString(),
      'Royalty amount should be 10%'
    );

    await erc721with2981.setRoyalties(artist, {
      from: owner,
    });
    royaltyInfo = await erc721with2981.royaltyInfo(tokenId, price, {
      from: addrSeller1,
    });
    receiver = royaltyInfo['receiver'];
    royaltyAmount = royaltyInfo['royaltyAmount'];

    assert.strictEqual(receiver, artist, 'Artist should now be the artist');
    assert.strictEqual(
      royaltyAmount.toString(),
      expectedToyaltyAmount.toString(),
      'Royalty amount should be 10%'
    );
    await erc721with2981.setApprovalForAll(marketplace.address, true, {
      from: addrSeller2,
    });

    let { listing, lstPtr } = await listItem(
      marketplace,
      nftAddress,
      tokenId,
      price,
      paymentToken,
      addrSeller2
    );

    let actualListing = listing.slice(0, 7);

    let expectedListing = [
      lstPtr.toString(), //listPtr
      erc721with2981.address, //nftAddress
      `${tokenId}`, //tokenId
      addrSeller2, //seller
      price.toString(), //price
      paymentToken, //paymentToken
      NFTType['ERC721_2981'], //nftType
    ];

    assert.deepStrictEqual(actualListing, expectedListing, 'listing looks as expected');

    // check royalties for listed item

    let listedRoyalties = await marketplace.getRoyalties(nftAddress, tokenId);

    receiver = listedRoyalties['0'];
    royaltyAmount = listedRoyalties['1'];

    assert.strictEqual(receiver, artist, 'Artist should now be the artist');
    assert.strictEqual(
      royaltyAmount.toString(),
      expectedToyaltyAmount.toString(),
      'Royalty amount should be 10%'
    );
  });

  it('Royalties are correctly set for ERC1155 if listing supports ERC2981', async () => {
    erc1155with2981 = await ERC1155WithERC2981Mock.new();
    let owner = accounts[0];
    let artist = accounts[5];
    let nftAddress = erc1155with2981.address;
    let tokenId = 1;
    let price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;

    await erc1155with2981.mint(addrSeller2, {
      from: owner,
    });

    let erc1155with2981OwnerOf1 = await erc1155with2981.balanceOf(addrSeller2, 1);
    assert.strictEqual(erc1155with2981OwnerOf1.toString(), '1');

    // get royalty info using a random account
    let royaltyInfo = await erc1155with2981.royaltyInfo(tokenId, price, {
      from: addrSeller1,
    });
    let receiver = royaltyInfo['receiver'];
    let royaltyAmount = royaltyInfo['royaltyAmount'];

    assert.strictEqual(receiver, owner, 'Minter should be intial owner');

    let expectedToyaltyAmount = new BN(price).mul(new BN('10')).div(new BN('100'));
    assert.strictEqual(
      royaltyAmount.toString(),
      expectedToyaltyAmount.toString(),
      'Royalty amount should be 10%'
    );

    await erc1155with2981.setRoyalties(artist, {
      from: owner,
    });
    royaltyInfo = await erc1155with2981.royaltyInfo(tokenId, price, {
      from: addrSeller1,
    });
    receiver = royaltyInfo['receiver'];
    royaltyAmount = royaltyInfo['royaltyAmount'];

    assert.strictEqual(receiver, artist, 'Artist should now be the artist');
    assert.strictEqual(
      royaltyAmount.toString(),
      expectedToyaltyAmount.toString(),
      'Royalty amount should be 10%'
    );

    await erc1155with2981.setApprovalForAll(marketplace.address, true, {
      from: addrSeller2,
    });

    let { listing, lstPtr } = await listItem(
      marketplace,
      nftAddress,
      tokenId,
      price,
      paymentToken,
      addrSeller2
    );

    let actualListing = listing.slice(0, 7);

    let expectedListing = [
      lstPtr.toString(), //listPtr
      erc1155with2981.address, //nftAddress
      `${tokenId}`, //tokenId
      addrSeller2, //seller
      price.toString(), //price
      paymentToken, //paymentToken
      NFTType['ERC1155_2981'], //nftType
    ];

    assert.deepStrictEqual(actualListing, expectedListing, 'listing looks as expected');

    // check royalties for listed item

    let listedRoyalties = await marketplace.getRoyalties(nftAddress, tokenId);

    receiver = listedRoyalties['0'];
    royaltyAmount = listedRoyalties['1'];

    assert.strictEqual(receiver, artist, 'Artist should now be the artist');
    assert.strictEqual(
      royaltyAmount.toString(),
      expectedToyaltyAmount.toString(),
      'Royalty amount should be 10%'
    );
  });

  // Royalties are correctly set if listing does not support ERC2981, but ERC1155 and ERC721 has owner
  it('Royalties are correctly set if listing does not support ERC2981, but ERC721 has owner', async () => {
    erc721 = await ERC721Mock.new();
    let owner = accounts[0];
    let artist = accounts[5];
    let nftAddress = erc721.address;
    let tokenId = 1;
    let price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;

    await erc721.mint(addrSeller2, {
      from: owner,
    });

    ownerOfTokenId = await erc721.ownerOf(tokenId);

    assert.strictEqual(ownerOfTokenId, addrSeller2, 'Owner of tokenId is not seller2');
    await erc721.setApprovalForAll(marketplace.address, true, {
      from: addrSeller2,
    });

    let { listing, lstPtr } = await listItem(
      marketplace,
      nftAddress,
      tokenId,
      price,
      paymentToken,
      addrSeller2
    );

    let actualListing = listing.slice(0, 7);

    let expectedListing = [
      lstPtr.toString(), //listPtr
      erc721.address, //nftAddress
      `${tokenId}`, //tokenId
      addrSeller2, //seller
      price.toString(), //price
      paymentToken, //paymentToken
      NFTType['ERC721'], //nftType
    ];

    assert.deepStrictEqual(actualListing, expectedListing, 'listing looks as expected');

    // check royalties for listed item

    let listedRoyalties = await marketplace.getRoyalties(nftAddress, tokenId);

    receiver = listedRoyalties['0'];
    royaltyAmount = listedRoyalties['1'];

    assert.strictEqual(royaltyAmount.toString(), '0', 'Royalty amount 0');
    assert.strictEqual(receiver, owner, 'Owner should be the royalty receiver');
  });

  it('Royalties are correctly set if listing does not support ERC2981, but ERC1155 has owner', async () => {
    erc1155 = await ERC1155Mock.new();
    let owner = accounts[0];
    let artist = accounts[5];
    let nftAddress = erc1155.address;
    let tokenId = 1;
    let price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;

    await erc1155.mint(addrSeller2, {
      from: owner,
    });

    let erc1155OwnerOf1 = await erc1155.balanceOf(addrSeller2, 1);
    assert.strictEqual(erc1155OwnerOf1.toString(), '1');

    assert.strictEqual(ownerOfTokenId, addrSeller2, 'Owner of tokenId is not seller2');
    await erc1155.setApprovalForAll(marketplace.address, true, {
      from: addrSeller2,
    });

    let { listing, lstPtr } = await listItem(
      marketplace,
      nftAddress,
      tokenId,
      price,
      paymentToken,
      addrSeller2
    );

    let actualListing = listing.slice(0, 7);

    let expectedListing = [
      lstPtr.toString(), //listPtr
      erc1155.address, //nftAddress
      `${tokenId}`, //tokenId
      addrSeller2, //seller
      price.toString(), //price
      paymentToken, //paymentToken
      NFTType['ERC1155'], //nftType
    ];

    assert.deepStrictEqual(actualListing, expectedListing, 'listing looks as expected');

    // check royalties for listed item

    let listedRoyalties = await marketplace.getRoyalties(nftAddress, tokenId);

    receiver = listedRoyalties['0'];
    royaltyAmount = listedRoyalties['1'];

    assert.strictEqual(royaltyAmount.toString(), '0', 'Royalty amount 0');
    assert.strictEqual(receiver, owner, 'Owner should be the royalty receiver');
  });

  // Royalties are correctly set if listing does not support ERC2981 and but ERC1155 and ERC721 does not have an owner
  it('Royalties are correctly set if listing does not support ERC2981 and but ERC721 does not have an owner', async () => {
    erc721 = await ERC721WithoutOwnerMock.new();
    let owner = accounts[0];
    let artist = accounts[5];
    let nftAddress = erc721.address;
    let tokenId = 1;
    let price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;

    await erc721.mint(addrSeller2, {
      from: owner,
    });

    ownerOfTokenId = await erc721.ownerOf(tokenId);

    assert.strictEqual(ownerOfTokenId, addrSeller2, 'Owner of tokenId is not seller2');
    await erc721.setApprovalForAll(marketplace.address, true, {
      from: addrSeller2,
    });

    let { listing, lstPtr } = await listItem(
      marketplace,
      nftAddress,
      tokenId,
      price,
      paymentToken,
      addrSeller2
    );

    let actualListing = listing.slice(0, 7);

    let expectedListing = [
      lstPtr.toString(), //listPtr
      erc721.address, //nftAddress
      `${tokenId}`, //tokenId
      addrSeller2, //seller
      price.toString(), //price
      paymentToken, //paymentToken
      NFTType['ERC721'], //nftType
    ];

    assert.deepStrictEqual(actualListing, expectedListing, 'listing looks as expected');

    // check royalties for listed item

    let listedRoyalties = await marketplace.getRoyalties(nftAddress, tokenId);

    receiver = listedRoyalties['0'];
    royaltyAmount = listedRoyalties['1'];

    assert.strictEqual(royaltyAmount.toString(), '0', 'Royalty amount 0');
    assert.strictEqual(receiver, constants.ZERO_ADDRESS, 'Owner should be the zero address');
  });

  it('Royalties are correctly set if listing does not support ERC2981 and but ERC1155 does not have an owner', async () => {
    erc1155 = await ERC1155WithoutOwnerMock.new();
    let owner = accounts[0];
    let artist = accounts[5];
    let nftAddress = erc1155.address;
    let tokenId = 1;
    let price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;

    await erc1155.mint(addrSeller2, {
      from: owner,
    });

    let erc1155OwnerOf1 = await erc1155.balanceOf(addrSeller2, 1);
    assert.strictEqual(erc1155OwnerOf1.toString(), '1');

    assert.strictEqual(ownerOfTokenId, addrSeller2, 'Owner of tokenId is not seller2');
    await erc1155.setApprovalForAll(marketplace.address, true, {
      from: addrSeller2,
    });

    let { listing, lstPtr } = await listItem(
      marketplace,
      nftAddress,
      tokenId,
      price,
      paymentToken,
      addrSeller2
    );

    let actualListing = listing.slice(0, 7);

    let expectedListing = [
      lstPtr.toString(), //listPtr
      erc1155.address, //nftAddress
      `${tokenId}`, //tokenId
      addrSeller2, //seller
      price.toString(), //price
      paymentToken, //paymentToken
      NFTType['ERC1155'], //nftType
    ];

    assert.deepStrictEqual(actualListing, expectedListing, 'listing looks as expected');

    // check royalties for listed item

    let listedRoyalties = await marketplace.getRoyalties(nftAddress, tokenId);

    receiver = listedRoyalties['0'];
    royaltyAmount = listedRoyalties['1'];

    assert.strictEqual(royaltyAmount.toString(), '0', 'Royalty amount 0');
    assert.strictEqual(
      receiver,
      constants.ZERO_ADDRESS,
      'zero address should be the royalty receiver'
    );
  });

  // allListings updated correctly if 3 items are listed
  it('allListings updated correctly if 3 ERC721 items are listed', async () => {
    let owner = accounts[0];
    erc721 = await ERC721Mock.new();
    let nftAddress = erc721.address;
    let price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;

    // mint 3 tokens to addrSeller2
    for (let i = 0; i < 3; i++) {
      await erc721.mint(addrSeller2, {
        from: owner,
      });
    }

    // check that addrSeller2 has 3 tokens
    for (let i = 1; i <= 3; i++) {
      let erc721OwnerOf = await erc721.ownerOf(i);
      assert.strictEqual(erc721OwnerOf, addrSeller2, `Owner of tokenId=${i} is not seller2`);
    }

    // Approve marketplace for all 3 tokens
    for (let i = 1; i <= 3; i++) {
      await erc721.setApprovalForAll(marketplace.address, i, {
        from: addrSeller2,
      });
    }

    // List 3 items
    for (let i = 1; i <= 3; i++) {
      let { listing, lstPtr } = await listItem(
        marketplace,
        nftAddress,
        i,
        price,
        paymentToken,
        addrSeller2
      );

      let actualListing = listing.slice(0, 7);

      let expectedListing = [
        lstPtr.toString(), //listPtr
        erc721.address, //nftAddress
        `${i}`, //i
        addrSeller2, //seller
        price.toString(), //price
        paymentToken, //paymentToken
        NFTType['ERC721'], //nftType
      ];

      assert.deepStrictEqual(actualListing, expectedListing, 'listing looks as expected');
    }

    let allListings = await marketplace.getAllListings();

    allListings = allListings.map((listing) => listingStructToObject(listing));

    const expectedListings = [
      {
        listPtr: '0',
        nftAddress: erc721.address,
        tokenId: '1',
        seller: addrSeller2,
        price: price.toString(),
        paymentToken: erc20.address,
        nftType: NFTType['ERC721'],
        reservedFor: ZERO_ADDRESS,
        reservedUntil: '0',
      },
      {
        listPtr: '1',
        nftAddress: erc721.address,
        tokenId: '2',
        seller: addrSeller2,
        price: price.toString(),
        paymentToken: erc20.address,
        nftType: NFTType['ERC721'],
        reservedFor: ZERO_ADDRESS,
        reservedUntil: '0',
      },
      {
        listPtr: '2',
        nftAddress: erc721.address,
        tokenId: '3',
        seller: addrSeller2,
        price: price.toString(),
        paymentToken: erc20.address,
        nftType: NFTType['ERC721'],
        reservedFor: ZERO_ADDRESS,
        reservedUntil: '0',
      },
    ];

    assert.deepStrictEqual(allListings, expectedListings, 'listings look as expected');
  });

  // allListings updated correctly if 4 items are listed, 2 from 1 seller, 2 from another
  it('allListings updated correctly if 4 ERC721 items are listed, 2 from seller 1, 2 from seller 2', async () => {
    let owner = accounts[0];
    erc721 = await ERC721Mock.new();
    let nftAddress = erc721.address;
    let price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;

    // mint 2 tokens to addrSeller1
    for (let i = 0; i < 2; i++) {
      await erc721.mint(addrSeller1, {
        from: owner,
      });
    }

    // mint 2 tokens to addrSeller2
    for (let i = 0; i < 2; i++) {
      await erc721.mint(addrSeller2, {
        from: owner,
      });
    }

    // check that addrSeller1 has the first 2 tokens
    for (let i = 1; i <= 2; i++) {
      let erc721OwnerOf = await erc721.ownerOf(i);
      assert.strictEqual(erc721OwnerOf, addrSeller1, `Owner of tokenId=${i} is not seller1`);
    }

    // check that addrSeller2 has the second 2 tokens
    for (let i = 3; i <= 4; i++) {
      let erc721OwnerOf = await erc721.ownerOf(i);
      assert.strictEqual(erc721OwnerOf, addrSeller2, `Owner of tokenId=${i} is not seller2`);
    }

    // Approve marketplace for seller 1's 2 tokens
    for (let i = 1; i <= 2; i++) {
      await erc721.setApprovalForAll(marketplace.address, i, {
        from: addrSeller1,
      });
    }

    // Approve marketplace for seller 2's 2 tokens
    for (let i = 3; i <= 4; i++) {
      await erc721.setApprovalForAll(marketplace.address, i, {
        from: addrSeller2,
      });
    }

    // List 4 items
    for (let i = 1; i <= 4; i++) {
      const lister = i <= 2 ? addrSeller1 : addrSeller2;
      let { listing, lstPtr } = await listItem(
        marketplace,
        nftAddress,
        i,
        price,
        paymentToken,
        lister
      );

      let actualListing = listing.slice(0, 7);

      let expectedListing = [
        lstPtr.toString(), //listPtr
        erc721.address, //nftAddress
        `${i}`, //i
        lister, //seller
        price.toString(), //price
        paymentToken, //paymentToken
        NFTType['ERC721'], //nftType
      ];

      assert.deepStrictEqual(actualListing, expectedListing, 'listing looks as expected');
    }

    let allListings = await marketplace.getAllListings();

    allListings = allListings.map((listing) => listingStructToObject(listing));

    const expectedListings = [
      {
        listPtr: '0',
        nftAddress: erc721.address,
        tokenId: '1',
        seller: addrSeller1,
        price: price.toString(),
        paymentToken: erc20.address,
        nftType: NFTType['ERC721'],
        reservedFor: ZERO_ADDRESS,
        reservedUntil: '0',
      },
      {
        listPtr: '1',
        nftAddress: erc721.address,
        tokenId: '2',
        seller: addrSeller1,
        price: price.toString(),
        paymentToken: erc20.address,
        nftType: NFTType['ERC721'],
        reservedFor: ZERO_ADDRESS,
        reservedUntil: '0',
      },
      {
        listPtr: '2',
        nftAddress: erc721.address,
        tokenId: '3',
        seller: addrSeller2,
        price: price.toString(),
        paymentToken: erc20.address,
        nftType: NFTType['ERC721'],
        reservedFor: ZERO_ADDRESS,
        reservedUntil: '0',
      },
      {
        listPtr: '3',
        nftAddress: erc721.address,
        tokenId: '4',
        seller: addrSeller2,
        price: price.toString(),
        paymentToken: erc20.address,
        nftType: NFTType['ERC721'],
        reservedFor: ZERO_ADDRESS,
        reservedUntil: '0',
      },
    ];

    assert.deepStrictEqual(allListings, expectedListings, 'listings look as expected');
  });

  // allListings update correctly if 5 items are listed, and 2 sold
  it('allListings update correctly if 5 items are listed, and 2 sold', async () => {
    let owner = accounts[0];
    let artist1 = accounts[1];
    erc721 = await ERC721Mock.new();
    let nftAddress = erc721.address;
    let price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;

    // mint 5 tokens to addrSeller2
    for (let i = 0; i < 5; i++) {
      await erc721.mint(addrSeller2, {
        from: artist1,
      });
    }

    // check that addrSeller2 has 3 tokens
    for (let i = 1; i <= 5; i++) {
      let erc721OwnerOf = await erc721.ownerOf(i);
      assert.strictEqual(erc721OwnerOf, addrSeller2, `Owner of tokenId=${i} is not seller2`);
    }

    // Approve marketplace for all 3 tokens
    for (let i = 1; i <= 5; i++) {
      await erc721.setApprovalForAll(marketplace.address, i, {
        from: addrSeller2,
      });
    }

    // List 3 items
    for (let i = 1; i <= 5; i++) {
      let { listing, lstPtr } = await listItem(
        marketplace,
        nftAddress,
        i,
        price,
        paymentToken,
        addrSeller2
      );

      let actualListing = listing.slice(0, 7);

      let expectedListing = [
        lstPtr.toString(), //listPtr
        erc721.address, //nftAddress
        `${i}`, //i
        addrSeller2, //seller
        price.toString(), //price
        paymentToken, //paymentToken
        NFTType['ERC721'], //nftType
      ];

      assert.deepStrictEqual(actualListing, expectedListing, 'listing looks as expected');
    }

    let allListings = await marketplace.getAllListings();

    allListings = allListings.map((listing) => listingStructToObject(listing));

    let oneListing = {
      listPtr: '0',
      nftAddress: erc721.address,
      tokenId: '1',
      seller: addrSeller2,
      price: price.toString(),
      paymentToken: erc20.address,
      nftType: NFTType['ERC721'],
      reservedFor: ZERO_ADDRESS,
      reservedUntil: '0',
    };

    let expectedListings = [1, 2, 3, 4, 5].map((i) => {
      return Object.assign({}, oneListing, { tokenId: `${i}`, listPtr: `${i - 1}` });
    });

    assert.deepStrictEqual(allListings, expectedListings, 'listings look as expected');

    await expectRevert(
      marketplace.unlist(nftAddress, 1, {
        from: addrSeller1,
      }),
      'Only seller of NFT can unlist'
    );

    // unlist
    await marketplace.unlist(nftAddress, 3, { from: addrSeller2 });
    await marketplace.unlist(nftAddress, 2, { from: addrSeller2 });

    allListings = await marketplace.getAllListings();

    allListings = allListings.map((listing) => listingStructToObject(listing));

    expectedListings = [
      {
        listPtr: '0',
        nftAddress: erc721.address,
        tokenId: '1',
        seller: addrSeller2,
        price: price.toString(),
        paymentToken: erc20.address,
        nftType: NFTType['ERC721'],
        reservedFor: ZERO_ADDRESS,
        reservedUntil: '0',
      },
      {
        listPtr: '1',
        nftAddress: erc721.address,
        tokenId: '4',
        seller: addrSeller2,
        price: price.toString(),
        paymentToken: erc20.address,
        nftType: NFTType['ERC721'],
        reservedFor: ZERO_ADDRESS,
        reservedUntil: '0',
      },
      {
        listPtr: '2',
        nftAddress: erc721.address,
        tokenId: '5',
        seller: addrSeller2,
        price: price.toString(),
        paymentToken: erc20.address,
        nftType: NFTType['ERC721'],
        reservedFor: ZERO_ADDRESS,
        reservedUntil: '0',
      },
    ];

    assert.deepStrictEqual(allListings, expectedListings, 'listings look as expected');
  });
});
