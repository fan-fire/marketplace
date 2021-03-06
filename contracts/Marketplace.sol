// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import '@openzeppelin/contracts/interfaces/IERC721.sol';
import '@openzeppelin/contracts/interfaces/IERC20.sol';
import '@openzeppelin/contracts/interfaces/IERC1155.sol';
import '@openzeppelin/contracts/interfaces/IERC2981.sol';
import '@openzeppelin/contracts/security/Pausable.sol';
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import {ERC165Checker} from '@openzeppelin/contracts/utils/introspection/ERC165Checker.sol';
import './Storage.sol';

contract Marketplace is Storage, Pausable, ReentrancyGuard {
    using ERC165Checker for address;
    event ProtocolWalletChanged(address newProtocolWallet);
    event ProtocolFeeChanged(uint256 newProtocolFeeNumerator, uint256 newProtocolFeeDenominator);
    event Listed(
        uint256 listPtr,
        address indexed nftAddress,
        uint256 indexed tokenId,
        address indexed seller,
        uint256 price,
        address paymentToken,
        NFTType nftType,
        address royaltyReceiver,
        uint256 royaltyAmount
    );
    event Bought(
        uint256 listPtr,
        address indexed nftAddress,
        uint256 indexed tokenId,
        address indexed buyer,
        uint256 price,
        address paymentToken,
        NFTType nftType,
        address royaltyReceiver,
        uint256 royaltyAmount
    );
    event PaymentTokenAdded(address indexed paymentToken);
    // event PaymentTokenRemoved(address indexed paymentToken);
    event FundsWithdrawn(address indexed to, address indexed paymentToken, uint256 amount);
    event RoyaltiesSet(
        address indexed nftAddress,
        uint256 indexed tokenId,
        address indexed royaltyReceiver,
        uint256 royaltyAmount
    );
    event Unlisted(address indexed nftAddress, uint256 indexed tokenId);

    event Reserved(
        address indexed nftAddress,
        uint256 indexed tokenId,
        address indexed reservedFor,
        uint256 period,
        uint256 reservedUntil
    );

    event UnlistStale(address indexed nftAddress, uint256 indexed tokenId);

    /**
     * @dev List an NFT with `tokenId` deployed at `nftAddress` for `price` wei of an ERC20 token deployed to `paymentToken`
     *
     * Requirements:
     *
     * - `nftAddress` must be a contract that implements {IERC721}
     * - `tokenId` must be a valid token ID for `nftAddress`
     * - `price` must be greater than 0
     * - `paymentToken` must be a contract that implements {IERC20}
     *
     * Emits a {Listed} event.
     */
    function list(
        address nftAddress,
        uint256 tokenId,
        uint256 price,
        address paymentToken
    ) public whenNotPaused {
        // check that the NFT not listed already
        require(!_isListed[nftAddress][tokenId], 'NFT already listed');
        // update _isListed first to avoid reentrancy 
        _isListed[nftAddress][tokenId] = true;
        require(nftAddress.supportsERC165(), 'NFT not ERC165');

        bool isERC721 = nftAddress.supportsInterface(type(IERC721).interfaceId);
        bool isERC1155 = nftAddress.supportsInterface(type(IERC1155).interfaceId);
        bool isERC2981 = nftAddress.supportsInterface(type(IERC2981).interfaceId);

        // check if payment token is in isPaymentToken
        require(isPaymentToken(paymentToken), 'Invalid payment token');
        // check if nft supports either ERC721 or ERC1155
        require(isERC721 || isERC1155, 'NFT not ERC721 nor ERC1155');

        // check if sender owns NFT-tokenId
        // check that marketplace is allowed to transfer NFT-tokenId
        if (isERC1155) {
            require(IERC1155(nftAddress).balanceOf(msg.sender, tokenId) > 0, 'Sender not owner');
            require(
                IERC1155(nftAddress).isApprovedForAll(msg.sender, address(this)),
                'Marketplace not approved'
            );
        }
        if (isERC721) {
            require(IERC721(nftAddress).ownerOf(tokenId) == msg.sender, 'Sender not owner');
            require(
                IERC721(nftAddress).isApprovedForAll(msg.sender, address(this)),
                'Marketplace not approved'
            );
        }

        // check price > 0
        require(price > 0, 'Invalid price');

        // get NFT type, one of ERC721, ERC1155, ERC721_2981, ERC1155_2981
        NFTType nftType;
        if (isERC1155 && !isERC2981) {
            nftType = NFTType.ERC1155;
        } else if (isERC721 && !isERC2981) {
            nftType = NFTType.ERC721;
        } else if (isERC1155 && isERC2981) {
            nftType = NFTType.ERC1155_2981;
        } else if (isERC721 && isERC2981) {
            nftType = NFTType.ERC721_2981;
        }

        // get numListings for listPtr
        uint256 listPtr = numListings;
        // create listing
        Listing memory listing = Listing(
            listPtr,
            nftAddress,
            tokenId,
            msg.sender,
            price,
            paymentToken,
            nftType,
            0,
            address(0)
        );

        numListings = numListings + 1;

        // if nft supports ERC2981, create Royalties for nftAddress/tokenId and set artist=receiver
        //    else check if ERC721 or ERC1155 has owner(), if yes set artist=recever
        //    else set artist=0x00
        Royalty memory royalty = Royalty(address(0), 0);
        if (isERC2981) {
            address receiver;
            uint256 royaltyAmount;
            (receiver, royaltyAmount) = IERC2981(nftAddress).royaltyInfo(tokenId, price);
            royalty = Royalty(receiver, royaltyAmount);
        } else {
            bytes memory data = abi.encodeWithSignature('owner()');
            (bool success, bytes memory returnData) = nftAddress.call{value: 0}(data);

            // if nft has owner(), set it as royalty beneficiary
            if (success) {
                address returnedAddress;

                returnedAddress = abi.decode(returnData, (address));
                royalty = Royalty(returnedAddress, 0);
            } else {
                royalty = Royalty(address(0), 0);
            }
        }
        // set royalties mapping
        _setRoyalties(nftAddress, tokenId, royalty);

        // update _token2Ptr
        _token2Ptr[nftAddress][tokenId] = listPtr;

        // add to _listings
        _listings.push(listing);

        emit Listed(
            listPtr,
            nftAddress,
            tokenId,
            msg.sender,
            price,
            paymentToken,
            nftType,
            royalty.receiver,
            royalty.royaltyAmount
        );
    }

    /**
     * @dev Retuns the isSellerOwner and isTokenstillApproved state of a listed NFT deployed at `nftAddress` with tokenId `tokenId`
     *
     * Requirements:
     *
     * - `nftAddress` must be a contract that implements {IERC721}
     * - `tokenId` must be a valid token ID for `nftAddress`
     */
    function status(address nftAddress, uint256 tokenId)
        public
        view
        returns (bool isSellerOwner, bool isTokenStillApproved)
    {
        require(_isListed[nftAddress][tokenId], 'NFT not listed');

        bool isSellerOwner = false;
        bool isTokenStillApproved = false;
        Listing memory listing = _listings[_token2Ptr[nftAddress][tokenId]];

        // check that current owner is still the owner and the marketplace is still approved, otherwise unlist
        if (listing.nftType == NFTType.ERC721 || listing.nftType == NFTType.ERC721_2981) {
            isSellerOwner = IERC721(listing.nftAddress).ownerOf(listing.tokenId) == listing.seller;
            isTokenStillApproved = IERC721(listing.nftAddress).isApprovedForAll(
                listing.seller,
                address(this)
            );
        } else if (listing.nftType == NFTType.ERC1155 || listing.nftType == NFTType.ERC1155_2981) {
            isSellerOwner =
                IERC1155(listing.nftAddress).balanceOf(listing.seller, listing.tokenId) > 0;
            isTokenStillApproved = IERC1155(listing.nftAddress).isApprovedForAll(
                listing.seller,
                address(this)
            );
        }

        return (isSellerOwner, isTokenStillApproved);
    }

    /**
     * @dev Allows anyone to unlist a token that has gone "Stale"
     * (i.e. either the lister is not the owner anymore or the owner has remove the approve all privelages of the marketplace)
     *
     * Requirements:
     *
     * - `nftAddress` must be a contract that implements {IERC721}
     * - `tokenId` must be a valid token ID for `nftAddress`
     *
     * Emits a {UnlistStale} event.
     */
    function unlistStale(address nftAddress, uint256 tokenId) public whenNotPaused {
        // check that the NFT is listed
        require(_isListed[nftAddress][tokenId], 'NFT not listed');

        // check if listing is still valid
        bool isSellerOwner;
        bool isTokenStillApproved;
        (isSellerOwner, isTokenStillApproved) = status(nftAddress, tokenId);

        // if listing is still valid, do nothing

        if (isSellerOwner && isTokenStillApproved) {
            return;
        }

        // unlist
        emit UnlistStale(nftAddress, tokenId);
        require(_unlist(nftAddress, tokenId), 'NFT could not be unlisted');
    }

    /**
     * @dev Allows a wallet with the RESERVER_ROLE to reserve a token (`nftAddress:tokenId`) for address `reservee` for `period` seconds.
     * The max period that a token can be reseved is specified by MAX_RESERVE_PERIOD.
     *
     * Requirements:
     *
     * - `nftAddress` must be a contract that implements {IERC721}
     * - `tokenId` must be a valid token ID for `nftAddress`
     * - `period` must be a valid period in seconds
     * - `reservee` must be a valid address
     *
     * Emits a {Reserved} event.
     */
    function reserve(
        address nftAddress,
        uint256 tokenId,
        uint256 period,
        address reservee
    ) public onlyRole(RESERVER_ROLE) whenNotPaused {
        require(period < MAX_RESERVE_PERIOD, 'Invalid period');
        require(_isListed[nftAddress][tokenId], 'NFT not listed');

        Listing memory listing = getListing(nftAddress, tokenId);

        listing.reservedFor = reservee;
        listing.reservedUntil = block.timestamp + period;

        _listings[listing.listPtr] = listing;
        emit Reserved(nftAddress, tokenId, reservee, period, block.timestamp + period);
    }

    /**
     * @dev Buys a listed token (`nftAddress:tokenId`) for the `price` tokens of `paymentToken` it was listed for
     *
     * Requirements:
     *
     * - `nftAddress` must be a contract that implements {IERC721}
     * - `tokenId` must be a valid token ID for `nftAddress`
     *
     * Emits a {Bought} event.
     */
    function buy(address nftAddress, uint256 tokenId) public whenNotPaused nonReentrant {
        // check _isListed
        require(_isListed[nftAddress][tokenId], 'NFT not listed');

        // check if listing is still valid
        bool isSellerOwner;
        bool isTokenStillApproved;
        (isSellerOwner, isTokenStillApproved) = status(nftAddress, tokenId);

        require(isSellerOwner, 'NFT not owned by seller anymore');
        require(isTokenStillApproved, 'NFT not approved anymore');

        // get listing
        uint256 listPtr = _token2Ptr[nftAddress][tokenId];
        Listing memory listing = _listings[listPtr];

        // check reserving
        if (block.timestamp < listing.reservedUntil) {
            require(listing.reservedFor == msg.sender, 'NFT reserved for another account');
        }

        // check balance of msg.sender for listed item
        uint256 price = listing.price;
        address paymentToken = listing.paymentToken;

        require(IERC20(paymentToken).balanceOf(msg.sender) >= price, 'Insufficient funds');
        // check if marketplace is allowed to transfer payment token
        require(
            //  allowance(address owner, address spender)
            IERC20(paymentToken).allowance(msg.sender, address(this)) >= price,
            'Marketplace not approved'
        );

        // get royalties from mapping
        Royalty memory royalty = getRoyalties(nftAddress, tokenId);

        // unlist token
        require(_unlist(nftAddress, tokenId), 'Unlist failed');

        // transfer funds to marketplace

        require(
            IERC20(paymentToken).transferFrom(msg.sender, address(this), price),
            'ERC20 transfer failed'
        );

        // update _balances
        uint256 royaltyAmount = royalty.royaltyAmount;
        uint256 protocolAmount = (price * protocolFeeNumerator) / protocolFeeDenominator;

        // pay seller
        _balances[paymentToken][listing.seller] =
            _balances[paymentToken][listing.seller] +
            price -
            royaltyAmount -
            protocolAmount;

        // pay artist
        _balances[paymentToken][royalty.receiver] =
            _balances[paymentToken][royalty.receiver] +
            royaltyAmount;

        // pay protocol
        _balances[paymentToken][protocolWallet] =
            _balances[paymentToken][protocolWallet] +
            protocolAmount;

        // INTEGRATIONS
        if (listing.nftType == NFTType.ERC721 || listing.nftType == NFTType.ERC721_2981) {
            IERC721(nftAddress).safeTransferFrom(listing.seller, msg.sender, tokenId);
        } else if (listing.nftType == NFTType.ERC1155 || listing.nftType == NFTType.ERC1155_2981) {
            IERC1155(nftAddress).safeTransferFrom(listing.seller, msg.sender, tokenId, 1, '');
        }
        emit Bought(
            listPtr,
            nftAddress,
            tokenId,
            msg.sender,
            price,
            paymentToken,
            listing.nftType,
            royalty.receiver,
            royalty.royaltyAmount
        );
    }

    /**
     * @dev Returns the reserve status of a token (`nftAddress:tokenId`)
     *
     * Requirements:
     *
     * - `nftAddress` must be a contract that implements {IERC721}
     * - `tokenId` must be a valid token ID for `nftAddress`
     */
    function getReservedState(address nftAddress, uint256 tokenId)
        public
        view
        returns (address reservedFor, uint256 reservedUntil)
    {
        require(_isListed[nftAddress][tokenId], 'NFT not listed');

        Listing memory listing = getListing(nftAddress, tokenId);

        address reservedFor = listing.reservedFor;
        uint256 reservedUntil = listing.reservedUntil;

        return (reservedFor, reservedUntil);
    }

    /**
     * @dev Unlist a listed token (`nftAddress:tokenId`) - only the lister of a token can unlist
     *
     * Requirements:
     *
     * - `nftAddress` must be a contract that implements {IERC721}
     * - `tokenId` must be a valid token ID for `nftAddress`
     *
     * Emits a {Unlisted} event.
     */
    function unlist(address nftAddress, uint256 tokenId) public whenNotPaused {
        require(_isListed[nftAddress][tokenId], 'NFT not listed');
        Listing memory listing = getListing(nftAddress, tokenId);

        // check reserving
        require(block.timestamp >= listing.reservedUntil, 'NFT reserved');

        require(listing.seller == msg.sender, 'Only seller of NFT can unlist');
        assert(_unlist(nftAddress, tokenId));
    }

    /**
     * @dev Internal method to unlist a token (`nftAddress:tokenId`)
     * Requirements:
     *
     * - `nftAddress` must be a contract that implements {IERC721}
     * - `tokenId` must be a valid token ID for `nftAddress`
     *
     * Emits a {UnlistStale} event.
     */
    function _unlist(address nftAddress, uint256 tokenId) private returns (bool) {
        Listing memory listingToRemove = getListing(nftAddress, tokenId);
        uint256 listPtrToRemove = listingToRemove.listPtr;
        // pop from _listings,
        Listing memory lastListing = _listings[_listings.length - 1];
        lastListing.listPtr = listPtrToRemove;
        _listings[listPtrToRemove] = lastListing;
        _listings.pop();

        // update _token2Ptr
        _token2Ptr[lastListing.nftAddress][lastListing.tokenId] = listPtrToRemove;

        // decrease numListings
        numListings = numListings - 1;
        // !don't remove from royatlies
        _isListed[nftAddress][tokenId] = false;
        assert(numListings >= 0);
        emit Unlisted(nftAddress, tokenId);
        return true;
    }

    /**
     * @dev Internal method to set the royalties associated with a token (`nftAddress:tokenId`)
     * Requirements:
     *
     * - `nftAddress` must be a contract that implements {IERC721}
     * - `tokenId` must be a valid token ID for `nftAddress`
     * - `royalty`
     *      `.receiver` must be a valid address
     *      `.royaltyAmount` must be greater than 0
     *
     * Emits a {RoyaltiesSet} event.
     */
    function _setRoyalties(
        address nftAddress,
        uint256 tokenId,
        Royalty memory royalty
    ) internal whenNotPaused {
        _royalties[nftAddress][tokenId] = royalty;
        emit RoyaltiesSet(nftAddress, tokenId, royalty.receiver, royalty.royaltyAmount);
    }

    /**
     * @dev External method to look up the index in the listings array which corresponds to a token (`nftAddress:tokenId`)
     * Requirements:
     *
     * - `nftAddress` must be a contract that implements {IERC721}
     * - `tokenId` must be a valid token ID for `nftAddress`
     */
    function getListingPointer(address nftAddress, uint256 tokenId)
        external
        view
        returns (uint256)
    {
        require(_isListed[nftAddress][tokenId], 'NFT not listed');
        return _token2Ptr[nftAddress][tokenId];
    }

    /**
     * @dev Method that only the owner of the Marketplace can call to add approved ERC20 address to be accepted as payment for listings
     * Requirements:
     *
     * - `paymentToken` must be a valid ERC20 address
     *
     * Emits a {PaymentTokenAdded} event.
     */
    function addPaymentToken(address paymentToken) public onlyOwner {
        // check if payment token is in isPaymentToken
        require(!isPaymentToken(paymentToken), 'Payment token already added');
        require(paymentToken != address(0), '0x00 not allowed');
        _isPaymentToken[paymentToken] = true;
        emit PaymentTokenAdded(paymentToken);
    }

    /**
     * @dev Method that only the owner of the Marketplace can call to change the wallet to which the protocol fee is allocated
     * Requirements:
     *
     * - `newProtocolWallet` must be a valid address
     *
     * Emits a {ProtocolWalletChanged} event.
     */
    function changeProtocolWallet(address newProtocolWallet) public onlyOwner {
        require(newProtocolWallet != address(0), '0x00 not allowed');
        protocolWallet = newProtocolWallet;
        emit ProtocolWalletChanged(newProtocolWallet);
    }

    /**
     * @dev Method that only the owner of the Marketplace can call to change the percentage of the protocol fee that is allocated to the protocol wallet
     * Requirements:
     *
     * - `newProtocolFeeNumerator` must be greater or equal to 0
     * - `newProtocolFeeDenominator` must be greater than 0
     *
     * Emits a {ProtocolFeeChanged} event.
     */
    function changeProtocolFee(uint256 newProtocolFeeNumerator, uint256 newProtocolFeeDenominator)
        public
        onlyOwner
    {
        require(newProtocolFeeDenominator != 0, 'denominator cannot be 0');
        protocolFeeNumerator = newProtocolFeeNumerator;
        protocolFeeDenominator = newProtocolFeeDenominator;
        emit ProtocolFeeChanged(newProtocolFeeNumerator, newProtocolFeeDenominator);
    }

    /**
     * @dev External view method to check if a token (`nftAddress:tokenId`) is listed
     * Requirements:
     *
     * - `nftAddress` must be a contract that implements {IERC721}
     * - `tokenId` must be a valid token ID for `nftAddress`
     */
    function isListed(address nftAddress, uint256 tokenId) external view returns (bool) {
        return _isListed[nftAddress][tokenId];
    }

    /**
     * @dev External view method to check if a ERC20 token is accepted as payment for listings
     * Requirements:
     *
     * - `tokenAddress` must be a valid ERC20 address
     */
    function isPaymentToken(address tokenAddress) public view returns (bool) {
        return _isPaymentToken[tokenAddress];
    }

    /**
     * @dev Public method that returns the amount of ERC20 located at `paymentToken` that `account` has available to be pulled from the marketplace.
     * Requirements:
     *
     * - `account` must be a valid address
     * - `paymentToken` must be a valid ERC20 address
     */
    function getBalance(address paymentToken, address account) public view returns (uint256) {
        require(isPaymentToken(paymentToken), 'Unkown payment token');
        return _balances[paymentToken][account];
    }

    /**
     * @dev Helper public method to return a listing given the index in the listings array obtained using getListingPointer()
     * Requirements:
     *
     * - `listPtr` must be a valid index in the listings array
     */
    function getListingByPointer(uint256 listPtr) public view returns (Listing memory) {
        require(listPtr < _listings.length, 'listPtr out of bounds');
        return _listings[listPtr];
    }

    /**
     * @dev Helper public method to return a listing given the address of the token and the token ID (`nftAddress:tokenId`)
     * Requirements:
     *
     * - `nftAddress` must be a contract that implements {IERC721}
     * - `tokenId` must be a valid token ID for `nftAddress`
     */
    function getListing(address nftAddress, uint256 tokenId) public view returns (Listing memory) {
        // check _isListed
        require(_isListed[nftAddress][tokenId], 'NFT not listed');
        return _listings[_token2Ptr[nftAddress][tokenId]];
    }

    /**
     * @dev Method that returns the entire listings array
     */
    function getAllListings() external view returns (Listing[] memory) {
        return _listings;
    }

    /**
     * @dev Get royalties of a listed token (`nftAddress:tokenId`)
     * Requirements:
     *
     * - `nftAddress` must be a contract that implements {IERC721}
     * - `tokenId` must be a valid token ID for `nftAddress`
     */
    function getRoyalties(address nftAddress, uint256 tokenId)
        public
        view
        returns (Royalty memory)
    {
        // check _isListed
        require(_isListed[nftAddress][tokenId], 'NFT not listed');
        // return royalties
        return _royalties[nftAddress][tokenId];
    }

    /**
     * @dev Method that enables the seller of a token to set the royalites for a listing\
     * If the NFT supports ERC2981 then the listing is updated with the new royalty specified in the ERC2981
     * If the NFT does not support ERC2981 - the amount is set for the listing specified by `amount`
     * Requirements:
     *
     * - `nftAddress` must be a contract that implements {IERC721}
     * - `tokenId` must be a valid token ID for `nftAddress`
     * - `amount` must be greater than 0, ignored if the NFT supports ERC2981
     *
     * Emits a {RoyaltiesSet} event.
     */
    function updateRoyaltyAmount(
        address nftAddress,
        uint256 tokenId,
        uint256 amount
    ) public {
        require(_isListed[nftAddress][tokenId], 'NFT not listed');
        Royalty memory royalty = getRoyalties(nftAddress, tokenId);
        require(royalty.receiver != address(0), 'Token has no owner');
        require(royalty.receiver == msg.sender, 'Only royalty receiver');
        require(royalty.royaltyAmount != amount, 'Invalid amount');

        bool isERC2981 = nftAddress.supportsInterface(type(IERC2981).interfaceId);

        if (isERC2981) {
            Listing memory listing = getListing(nftAddress, tokenId);
            address receiver;
            uint256 royaltyAmount;
            (receiver, royaltyAmount) = IERC2981(nftAddress).royaltyInfo(tokenId, listing.price);
            royalty = Royalty(receiver, royaltyAmount);
        } else {
            Listing memory listing = getListing(nftAddress, tokenId);
            uint256 curRoyaltyAmount = royalty.royaltyAmount;
            royalty.royaltyAmount = amount;
            listing.price = listing.price - curRoyaltyAmount + amount;
            _listings[listing.listPtr] = listing;
        }

        _setRoyalties(nftAddress, tokenId, royalty);
    }

    /**
     * @dev Method to pull funds from the marketplace for msg.sender.
     *
     * - `paymentToken` must be a valid ERC20 address
     * - `amount` must be greater than 0
     */
    function pullFunds(address paymentToken, uint256 amount) public whenNotPaused nonReentrant {
        // Checks
        require(isPaymentToken(paymentToken), 'Payment token not supported');
        require(amount > 0, 'Amount must be greater than 0');
        require(_balances[paymentToken][msg.sender] >= amount, 'Insufficient funds');
        // Effects
        uint256 curBalance = _balances[paymentToken][msg.sender];
        _balances[paymentToken][msg.sender] = curBalance - amount;

        // Integrations
        IERC20(paymentToken).transfer(msg.sender, amount);

        assert(_balances[paymentToken][msg.sender] == curBalance - amount);
        emit FundsWithdrawn(msg.sender, paymentToken, amount);
    }

    /**
     * @dev Method to pause the marketplace.
     *
     */
    function pause() public onlyOwner {
        _pause();
    }

    /**
     * @dev Method to unpause the marketplace.
     *
     */
    function unpause() public onlyOwner {
        _unpause();
    }
}
