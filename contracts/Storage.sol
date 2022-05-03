// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/Strings.sol';
import '@openzeppelin/contracts/access/AccessControl.sol';

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

    // Royalites of the NFT which maps from a listPtr to royalty.
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
