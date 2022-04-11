const Marketplace = artifacts.require('Marketplace');
const MarketplaceV2 = artifacts.require('MarketplaceV2');
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
  time,
} = require('@openzeppelin/test-helpers');

const Web3 = require('web3');
const web3 = new Web3('http://localhost:8545');
const fromWei = web3.utils.fromWei;
const toWei = web3.utils.toWei;

const RESERVER_ROLE = web3.utils.soliditySha3('RESERVER_ROLE');
const NFTType = {
  ERC721: '0',
  ERC721_2981: '1',
  ERC1155: '2',
  ERC1155_2981: '3',
};

let protocolFeeNumerator = new web3.utils.BN('2500000000000'); //Numerator of the protocol fee
let protocolFeeDenominator = new web3.utils.BN('100000000000000'); //Denominator of the protocol fee

const fs = require('fs');
var assert = require('assert');
const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants');
const { eventEmitted, truffleAssert } = require('truffle-assertions');

const { calcFunds, listingStructToObject, listItem } = require('./utils.js');

const upgradeMarketplaceToV2 = async (marketplaceProxy) => {
  let marketplaceV2 = await MarketplaceV2.new();
  await marketplaceProxy.upgrade(marketplaceV2.address);
  let marketplace = await MarketplaceV2.at(marketplaceProxy.address);

  return marketplace;
};

contract('Upgrade to Marketplace V2', async (accounts) => {
  const addrOwner = accounts[0];
  const addrNotOwner = accounts[1];

  const addrSeller1 = accounts[2];
  const addrBuyer1 = accounts[3];

  const addrSeller2 = accounts[4];
  const addrBuyer2 = accounts[5];

  let marketplace;
  let marketplaceV2;
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
  it('Can upgrade to MarketplaceV2', async () => {
    marketplaceV2 = await MarketplaceV2.new();
    await marketplaceProxy.upgrade(marketplaceV2.address);
    marketplace = await MarketplaceV2.at(marketplaceProxy.address);

    let currentMarketplace = await marketplace.currentMarketplace();

    assert.equal(currentMarketplace, marketplaceV2.address, 'Marketplace is not upgraded');
  });

  it("can't list ERC721 with setApprovalForAll on MarketplaceV2 ", async () => {
    let nftAddress = await erc721.address;
    let tokenId = 1;
    let price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;

    await erc721with2981.setApprovalForAll(marketplace.address, true, {
      from: addrSeller1,
    });

    await expectRevert(
      marketplace.list(nftAddress, tokenId, price, paymentToken, {
        from: addrSeller1,
      }),
      'Marketplace not approved'
    );
  });

  it('can list ERC721 with approve on MarketplaceV2 ', async () => {
    marketplace = await upgradeMarketplaceToV2(marketplaceProxy);

    let nftAddress = await erc721.address;
    let tokenId = 1;
    let price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;

    let ownerOf = await erc721.ownerOf(tokenId);
    assert.equal(ownerOf, addrSeller1, 'Owner is not correct');

    // approve(address to, uint256 tokenId) external;
    await erc721.approve(marketplace.address, tokenId, {
      from: addrSeller1,
    });

    let approvee = await erc721.getApproved(tokenId);
    assert.equal(approvee, marketplace.address, 'Approvee is not marketplace');

    await marketplace.list(nftAddress, tokenId, price, paymentToken, {
      from: addrSeller1,
    });

    let listing = await marketplace.getListing(nftAddress, tokenId);

    let expectedListing = {
      listPtr: '0',
      nftAddress: erc721.address,
      tokenId: '1',
      seller: addrSeller1,
      price: price,
      paymentToken: erc20.address,
      nftType: NFTType.ERC721,
      reservedUntil: '0',
      reservedFor: ZERO_ADDRESS,
    };

    assert.deepEqual(listingStructToObject(listing), expectedListing, 'Listing is not correct');
  });

  it('Keeps all previously listed listings after upgrade', async () => {
    // Before upgrade

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

    assert.deepStrictEqual(
      allListings,
      expectedListings,
      'listings look as expected before upgrade'
    );

    // Upgrade
    marketplace = await upgradeMarketplaceToV2(marketplaceProxy);

    allListings = await marketplace.getAllListings();
    allListings = allListings.map((listing) => listingStructToObject(listing));
    assert.deepStrictEqual(
      allListings,
      expectedListings,
      'listings look as expected after upgrade'
    );
  });

  it('Can buy tokens after upgrade that were listed before upgrade', async () => {
    let nftAddress = await erc721.address;
    let tokenId = 1;
    let price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;

    let ownerOf = await erc721.ownerOf(tokenId);
    assert.equal(ownerOf, addrSeller1, 'Owner is not correct');

    await erc721.setApprovalForAll(marketplace.address, true, {
      from: addrSeller1,
    });

    // console.log('listing');
    await marketplace.list(nftAddress, tokenId, price, paymentToken, {
      from: addrSeller1,
    });

    let listing = await marketplace.getListing(nftAddress, tokenId);

    let expectedListing = {
      listPtr: '0',
      nftAddress: erc721.address,
      tokenId: '1',
      seller: addrSeller1,
      price: price,
      paymentToken: erc20.address,
      nftType: NFTType.ERC721,
      reservedUntil: '0',
      reservedFor: ZERO_ADDRESS,
    };

    assert.deepEqual(listingStructToObject(listing), expectedListing, 'Listing is not correct');

    marketplace = await upgradeMarketplaceToV2(marketplaceProxy);

    let buyer = accounts[1];

    // console.log('transfering ERC20');
    await erc20.transfer(buyer, price, {
      from: addrOwner,
    });
    await erc20.approve(marketplace.address, price, {
      from: buyer,
    });
    let buyerBalanceBefore = await erc20.balanceOf(buyer);
    let sellerBalanceBefore = await erc20.balanceOf(addrSeller1);

    // console.log('buyerBalanceBefore', buyerBalanceBefore);
    // console.log('sellerBalanceBefore', sellerBalanceBefore);

    // console.log('buying');
    await marketplace.buy(nftAddress, tokenId, {
      from: buyer,
    });

    let buyerBalanceAfter = await erc20.balanceOf(buyer);

    assert.strictEqual(
      buyerBalanceAfter.toString(),
      '0',
      'Buyer balance is not correct afer buying'
    );

    let marketplaceBalance = new BN('975000000000000000');
    // console.log('marketplaceBalance', marketplaceBalance.toString());

    await marketplace.pullFunds(erc20.address, marketplaceBalance, {
      from: addrSeller1,
    });

    let sellerBalanceAfter = await erc20.balanceOf(addrSeller1);

    assert.strictEqual(
      sellerBalanceAfter.toString(),
      marketplaceBalance.toString(),
      'Seller balance is not correct after buying'
    );

    ownerOf = await erc721.ownerOf(tokenId);
    assert.strictEqual(ownerOf, buyer, 'Owner is not correct');
  });

  it('Statusses are intact after upgrade', async () => {
    let owner = accounts[0];
    erc721 = await ERC721Mock.new();
    let erc721_2 = await ERC721Mock.new();
    let nftAddress = erc721.address;
    let price = web3.utils.toWei('1', 'ether');
    let paymentToken = erc20.address;

    // mint 3 tokens to addrSeller2
    for (let i = 0; i < 2; i++) {
      await erc721.mint(addrSeller2, {
        from: owner,
      });
    }

    // check that addrSeller2 has 3 tokens
    for (let i = 1; i <= 2; i++) {
      let erc721OwnerOf = await erc721.ownerOf(i);
      assert.strictEqual(erc721OwnerOf, addrSeller2, `Owner of tokenId=${i} is not seller2`);
    }

    // Approve marketplace for all 3 tokens
    for (let i = 1; i <= 2; i++) {
      await erc721.setApprovalForAll(marketplace.address, i, {
        from: addrSeller2,
      });
    }

    // List 3 items
    for (let i = 1; i <= 2; i++) {
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

    // The second erc721 that we can test approval for all holds when token is still owned, and when transfered
    await erc721_2.mint(addrSeller2, {
      from: owner,
    });
    await erc721_2.mint(addrSeller2, {
      from: owner,
    });
    await erc721_2.setApprovalForAll(marketplace.address, 1, {
      from: addrSeller2,
    });

    await listItem(marketplace, erc721_2.address, 1, price, paymentToken, addrSeller2);
    await listItem(marketplace, erc721_2.address, 2, price, paymentToken, addrSeller2);

    let beforeStatusses = [];

    for (let i = 1; i <= 2; i++) {
      let status = await marketplace.status(nftAddress, i);
      beforeStatusses.push({
        isSellerOwner: status.isSellerOwner,
        isTokenStillApproved: status.isTokenStillApproved,
      });
    }

    for (let i = 1; i <= 2; i++) {
      let status = await marketplace.status(erc721_2.address, i);
      beforeStatusses.push({
        isSellerOwner: status.isSellerOwner,
        isTokenStillApproved: status.isTokenStillApproved,
      });
    }

    assert.deepStrictEqual(
      beforeStatusses,
      [
        {
          isSellerOwner: true,
          isTokenStillApproved: true,
        },
        {
          isSellerOwner: true,
          isTokenStillApproved: true,
        },
        {
          isSellerOwner: true,
          isTokenStillApproved: true,
        },
        {
          isSellerOwner: true,
          isTokenStillApproved: true,
        },
      ],
      'Statusses are correct before tampering'
    );

    for (let i = 0; i < beforeStatusses.length; i++) {
      assert.strictEqual(beforeStatusses[i].isSellerOwner, true, 'isSellerOwner is not true');
      assert.strictEqual(
        beforeStatusses[i].isTokenStillApproved,
        true,
        'isTokenStillApproved is not true'
      );
    }

    // 0: status good

    // 1: status bad because all approval was removed
    await erc721.setApprovalForAll(marketplace.address, false, {
      from: addrSeller2,
    });

    // 2: status bad because it was transferred
    await erc721.transferFrom(addrSeller2, addrSeller1, 2, {
      from: addrSeller2,
    });

    await erc721_2.transferFrom(addrSeller2, addrSeller1, 2, {
      from: addrSeller2,
    });

    let afterTamperingStatusses = [];

    for (let i = 1; i <= 2; i++) {
      let status = await marketplace.status(nftAddress, i);
      afterTamperingStatusses.push({
        isSellerOwner: status.isSellerOwner,
        isTokenStillApproved: status.isTokenStillApproved,
      });
    }
    for (let i = 1; i <= 2; i++) {
      let status = await marketplace.status(erc721_2.address, i);
      afterTamperingStatusses.push({
        isSellerOwner: status.isSellerOwner,
        isTokenStillApproved: status.isTokenStillApproved,
      });
    }

    let expectedAfterTamperingStatusses = [
      {
        isSellerOwner: true,
        isTokenStillApproved: false,
      },
      {
        isSellerOwner: false,
        isTokenStillApproved: false,
      },
      {
        isSellerOwner: true,
        isTokenStillApproved: true,
      },
      {
        isSellerOwner: false,
        isTokenStillApproved: true,
      },
    ];

    assert.deepStrictEqual(
      afterTamperingStatusses,
      expectedAfterTamperingStatusses,
      'Statusses are correct after tampering'
    );

    // Upgrade
    marketplace = await upgradeMarketplaceToV2(marketplaceProxy);

    let afterUpgradeStatusses = [];

    for (let i = 1; i <= 2; i++) {
      let status = await marketplace.status(nftAddress, i);
      afterUpgradeStatusses.push({
        isSellerOwner: status.isSellerOwner,
        isTokenStillApproved: status.isTokenStillApproved,
      });
    }
    for (let i = 1; i <= 2; i++) {
      let status = await marketplace.status(erc721_2.address, i);
      afterUpgradeStatusses.push({
        isSellerOwner: status.isSellerOwner,
        isTokenStillApproved: status.isTokenStillApproved,
      });
    }

    assert.deepStrictEqual(
      afterUpgradeStatusses,
      expectedAfterTamperingStatusses,
      'Statusses are correct after upgrade'
    );
  });

  it('Roles are intact after upgrade', async () => {
    let addrReserver = accounts[4];
    await marketplace.grantRole(RESERVER_ROLE, addrReserver);
    let addrReserverHasRole = await marketplace.hasRole(RESERVER_ROLE, addrReserver);
    assert.strictEqual(addrReserverHasRole, true, 'Reserver has role');

    // Upgrade
    marketplace = await upgradeMarketplaceToV2(marketplaceProxy);
    let addrReserverHasRoleAfterUpgrade = await marketplace.hasRole(RESERVER_ROLE, addrReserver);
    assert.strictEqual(addrReserverHasRoleAfterUpgrade, true, 'Reserver has role');
  });

});
