# Marketplace

## Introduction

A marketplace contract that can facilitate the listing and buying of ERC721 and ERC1155 tokens. The marketplace supports ERC2981 and calculates the royalties due to the receiver when an item is listed. If an ERC721 or ERC1155 does not support ERC2981, a low-level call is made to see if the NFT has an `owner` attribute, if so, this address is set to the receiver and this address can update the royalty amount after listing an NFT. 

Upon listing, the seller would have needed to approve the marketplace to spend the NFT. If the seller revokes the approval or transfers the NFT, the `unlistStale` method can be called to remove a listing from the listings array.

Any ERC20 token can be used to list an item (provided that it has been added to the list of supported payment tokens). Upon purchasing, the buyer's balance is checked to ensure they have enough ERC20 tokens to make the purchase, as well as making sure that the seller still owns the NFT and that the marketplace still has the approval to transfer the NFT.

The marketplace follows a pull funds method with regards to the ERC20 tokens transferred to the seller, artist and protocol's wallets. The `pullFunds` method can be used to extract available funds for a given ERC20 token. A protocol fee is charged for each purchase and a percentage of the ERC20 token (set using `protocolFeeNumerator` and `protocolFeeDenominator`) is transferred to the protocol wallet's balance in the marketplace.

## Getting Started

Install all the required packages

```bash
npm install
```

Make sure you have truffle globally installed

```bash
npm i -g truffle
```

Run the unit tests to make sure everything is working as it should. To do this, start up a local ganache server using `ganache-cli` then run

```bash 
truffle test
```

The marketplace uses a `TransparentUpgradeableProxy` proxy - to deploy both the proxy and marketplace see <a href='migrations/2_marketplace.js'>this</a> file - the gist of which is:

```javascript
// deploy the marketplace
await deployer.deploy(Marketplace);
let marketplace = await Marketplace.deployed();

// deploy the proxy, with the afore mentioned marketplace as the default marketplace
await deployer.deploy(MarketplaceProxy, marketplace.address);
let marketplaceProxy = await MarketplaceProxy.deployed();

// interact with the marketplace via the proxy using .at
marketplace = await Marketplace.at(marketplaceProxy.address);
```

The storage looks as follows and is shared by the Proxy and Marketplace contracts to ensure upgradability:

```sol

contract Storage is Ownable, AccessControl {
    address public currentMarketplace;
    address public protocolWallet;
    bytes32 public constant RESERVER_ROLE = keccak256('RESERVER_ROLE');
    uint256 public constant MAX_RESERVE_PERIOD = 24 * 60 * 60; /// can only reserve for a max of 1 day

    using Strings for address;
    enum NFTType {
        ERC721,
        ERC721_2981,
        ERC1155,
        ERC1155_2981
    }

    // Royalties of the NFT which maps from a listPtr to royalty.
    struct Royalty {
        address receiver;
        uint256 royaltyAmount;
    }

    struct Listing {
        uint256 listPtr; //Pointer to where this listing is located in the listings array
        address nftAddress; //Address of the ERC721 or ERC1155 contract of the listed item
        uint256 tokenId; //token ID of the listed item for nftAddress
        address seller; //Address of the seller
        uint256 price; //Price of the listed item
        address paymentToken; //Address of the ERC20 contract that will be used to pay for the listing 
        NFTType nftType; //Type of the listed item. Either ERC721 or ERC1155 with or without ERC2981
        uint256 reservedUntil; //Timestamp when the listing will be reserved
        address reservedFor; //Address of the buyer who reserved the listing
    }

    uint256 public numListings; //Number of listings in the marketplace
    mapping(address => bool) internal _isPaymentToken; //Whether a given ERC20 contract is an excepted payment token
    mapping(address => mapping(uint256 => Royalty)) internal _royalties; //Royalties of each nftAddress-tokenId pair
    mapping(address => mapping(uint256 => bool)) internal _isListed; //Mapping from address to mapping from tokenId to whether token is listed
    mapping(address => mapping(uint256 => uint256)) internal _token2Ptr; //Mapping from nft-address-tokenId to listPtr to quickly lookup the listing given nftAddress-tokenId
    mapping(address => mapping(address => uint256)) internal _balances; //Balances of each address for each ERC20 contract, 0x00 is the native coin

    uint256 public protocolFeeNumerator = 2500000000000; //Numerator of the protocol fee
    uint256 public protocolFeeDenominator = 100000000000000; //Denominator of the protocol fee
    Listing[] internal _listings; //Listings of the marketplace

    // Future proof a bit with string mappings to use for storage
    mapping(string => string) public stringStorage;
}

```

## Structure

The marketplace keeps an array of listings with structure:

```sol
struct Listing {
    uint256 listPtr; //Pointer to where this listing is located in the listings array
    address nftAddress; //Address of the ERC721 or ERC1155 contract of the listed item
    uint256 tokenId; //token ID of the listed item for nftAddress
    address seller; //Address of the seller
    uint256 price; //Price of the listed item
    address paymentToken; //Address of the ERC20 contract that will be used to pay for the listing 
    NFTType nftType; //Type of the listed item. Either ERC721 or ERC1155 with or without ERC2981
}
```

and only supports 4 types of NFTs, all of which need to implement `ERC165` to be listed

```sol
enum NFTType {
    ERC721,
    ERC721_2981,
    ERC1155,
    ERC1155_2981
}
```


## Methods


### General Usage

The 3 main methods are `list`, `buy` and `unlist`. 

`list` assumes that the owner of the NFT is listing the token and that `setApprovalForAll()` has been called on the NFT for the marketplace address by the token holder. The `price` is denominated in Wei in the ERC20 defined by `paymentToken`.

`buy` assumes that the buyer has at least `price`, and has approved the marketplace with at least `price` of the ERC20 token before calling the `buy` method.

`unlist` can only be called by the lister of an NFT. However, if a listing has gone stale (either the original seller has transferred the token after listing, or has revoked their approval) the listing can be unlisted using the `unlistStale` method by anyone.


```sol
list(
    address nftAddress,
    uint256 tokenId,
    uint256 price,
    address paymentToken
    ) public whenNotPaused 
```


```sol
buy(
    address nftAddress,
    uint256 tokenId
    ) public whenNotPaused nonReentrant
```

```sol
unlist(
    address nftAddress,
    uint256 tokenId
    ) public whenNotPaused
```

```sol
unlistStale(
    address nftAddress, 
    uint256 tokenId
    ) public whenNotPaused
```


### Querying


Current listings can be viewed using either the `getListingPointer`, `getListingByPointer`, `getListing` or `getAllListings` method - depending on what you'd like to do. The pointer returned and used by the `getListingPointer` and `getListingByPointer` methods is the place in the `_listings` array where the token is located.


```sol
getListingPointer(
    address nftAddress, 
    uint256 tokenId
    ) external view returns (uint256)
```


```sol
getListingByPointer(
    uint256 listPtr
    ) public view returns (Listing memory)
```

```sol
getListing(
    address nftAddress, 
    uint256 tokenId
    ) public view returns (Listing memory)
```

```sol
getAllListings() external view returns (Listing[] memory)
```

The `status` method can be used to verify that a token is still purchasable.

```sol
status(
    address nftAddress, 
    uint256 tokenId
    ) public view returns (
        bool isSellerOwner, 
        bool isTokenStillApproved
        )
```

`isListed` check if a given nft-tokenId is listed on the marketplace.

```sol
isListed(
    address nftAddress, 
    uint256 tokenId
    ) external view returns (bool)
```

`isPaymentToken` check whether a given ERC20 token can be used as a payment token.

```sol
isPaymentToken(
    address tokenAddress
    ) 
    public view returns (bool)
```

`getBalance` is used to check the balance of a given wallet-ERC20 token pair in the marketplace which can be pulled using `pullFunds`

```sol
getBalance(
    address paymentToken, 
    address account
    ) public view returns (uint256)
```

`getRoyalties` is used to check the total amount of royalties that will be paid to the artist when the purchase goes through.

```sol
getRoyalties(
    address nftAddress, 
    uint256 tokenId
    ) public view returns (Royalty memory)
```


### Admin methods

ERC20 payment tokens can be added by the `owner` using the `addPaymentToken` method:

```sol
addPaymentToken(
    address paymentToken
    ) public onlyOwner 
```

We saw a need to build a way for wallets with the `RESERVER_ROLE` privileges to be able to reserve a token for a specific wallet. This is required when dealing with FIAT purchases and the token needs to be put on hold until the FIAT payment clears to crypto and the purchase can be made. 

```sol
reserve(
    address nftAddress,
    uint256 tokenId,
    uint256 period,
    address reservee
    ) public onlyRole(RESERVER_ROLE) whenNotPaused
```

If the protocol wallet address needs to change, this can be done by the owner using the `changeProtocolWallet` method.

```sol
changeProtocolWallet(
    address newProtocolWallet
    ) public onlyOwner
```

Similarly, if the protocol fee needs to change, this can be done by the owner using the `changeProtocolFee` method.

```sol
changeProtocolFee(
    uint256 newProtocolFeeNumerator, 
    uint256 newProtocolFeeDenominator
    ) publics onlyOwner
```

The marketplace supports pausing and unpausing by the owner using the `pause` and `unpause` methods.


```sol
pause() public onlyOwner
```

```sol
unpause() public onlyOwner
```

### Artist methods

Artists can update their royalty amounts using the `updateRoyaltyAmount` method. In the case that an ERC721 or ERC1155 supports ERC2981, then the ERC2981 royaltyInfo method is called when calling `updateRoyaltyAmount` and the amount is updated based on the listing price - in other words, the `amount` can't be used if an NFT supports  ERC2981. The amount can however be set if the ERC721 or ERC1155 has an owner, then this owner is the only person who can update the amount - the royalty receiver can not be updated and the artist funds will always be allocated to the original owner's address. By default, the royalties is set to 0 for ERC721s and ERC1155 which have an owner. 

```sol
updateRoyaltyAmount(
    address nftAddress,
    uint256 tokenId,
    uint256 amount
    ) public
```


To pull the ERC20 funds for a given supported payment token address, a user would need to call the `pullFunds` method.

```sol
pullFunds(
    address paymentToken, 
    uint256 amount
    ) public whenNotPaused nonReentrant
```
