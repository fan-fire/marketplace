// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import '@openzeppelin/contracts/interfaces/IERC721.sol';
import '@openzeppelin/contracts/interfaces/IERC20.sol';
import '@openzeppelin/contracts/interfaces/IERC1155.sol';
import '@openzeppelin/contracts/interfaces/IERC2981.sol';
import '@openzeppelin/contracts/security/Pausable.sol';
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import {ERC165Checker} from '@openzeppelin/contracts/utils/introspection/ERC165Checker.sol';
import './Storage.sol';

contract MarketplaceMock is Storage, Pausable, ReentrancyGuard {
    using ERC165Checker for address;
    event Logz(string s);

    function list(
        address nftAddress,
        uint256 tokenId,
        uint256 price,
        address paymentToken
    ) public whenNotPaused {
        // check that the NFT not listed already
        require(!_isListed[nftAddress][tokenId], 'NFT already listed');
        require(nftAddress.supportsERC165(), 'NFT not ERC165');

        stringStorage['mock'] = 'mock';

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
            block.timestamp,
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

        // update _isListed
        _isListed[nftAddress][tokenId] = true;
    }

    function buy(address nftAddress, uint256 tokenId) public payable whenNotPaused nonReentrant {
        emit Logz('Mock buy');
    }

    function unlist(address nftAddress, uint256 tokenId) public whenNotPaused {
        require(_isListed[nftAddress][tokenId], 'NFT not listed');
        Listing memory listing = getListing(nftAddress, tokenId);
        require(listing.seller == msg.sender, 'Only seller of NFT can unlist');
        assert(_unlist(nftAddress, tokenId));
    }

    function _unlist(address nftAddress, uint256 tokenId) private returns (bool) {
        Listing memory listingToRemove = getListing(nftAddress, tokenId);
        uint256 listPtrToRemove = listingToRemove.listPtr;
        // pop from _listings,
        Listing memory lastListing = _listings[_listings.length - 1];
        lastListing.listPtr = listPtrToRemove;
        _listings[listPtrToRemove] = lastListing;
        _listings.pop();

        // decrease numListings
        numListings = numListings - 1;
        // !don't remove from royatlies
        _isListed[nftAddress][tokenId] = false;
        assert(numListings >= 0);
        return true;
    }

    function _setRoyalties(
        address nftAddress,
        uint256 tokenId,
        Royalty memory royalty
    ) internal whenNotPaused {
        _royalties[nftAddress][tokenId] = royalty;
    }

    function getListingPointer(address nftAddress, uint256 tokenId)
        external
        view
        returns (uint256)
    {
        require(_isListed[nftAddress][tokenId], 'NFT not listed');
        return _token2Ptr[nftAddress][tokenId];
    }

    // We add these ourselves as there is no way to determine if a
    // contract supports ERC20
    function addPaymentToken(address paymentToken) public onlyOwner {
        // check if payment token is in isPaymentToken
        require(!isPaymentToken(paymentToken), 'Payment token already added');

        _isPaymentToken[paymentToken] = true;
        // add payment token to isPaymentToken
    }

    // Would be nice to include this, but then we'd also have to remove all
    // the listings which had the previous token and pay out - so maybe not...
    // function removePaymentToken(address paymentToken) public onlyOwner {
    //     // check if payment token is in isPaymentToken
    //     require(isPaymentToken(paymentToken), 'Payment token not added');

    //     _isPaymentToken[paymentToken] = false;
    //     // add payment token to isPaymentToken

    //     emit PaymentTokenRemoved(paymentToken);
    // }

    function isListed(address nftAddress, uint256 tokenId) external view returns (bool) {
        return _isListed[nftAddress][tokenId];
    }

    function isPaymentToken(address tokenAddress) public view returns (bool) {
        return _isPaymentToken[tokenAddress];
    }

    function getBalance(address paymentToken, address account) public view returns (uint256) {
        require(isPaymentToken(paymentToken), 'Unkown payment token');
        return _balances[paymentToken][account];
    }

    function getListingByPointer(uint256 listPtr) public view returns (Listing memory) {
        require(listPtr < _listings.length, 'listPtr out of bounds');
        return _listings[listPtr];
    }

    function getListing(address nftAddress, uint256 tokenId) public view returns (Listing memory) {
        // check _isListed
        require(_isListed[nftAddress][tokenId], 'NFT not listed');
        return _listings[_token2Ptr[nftAddress][tokenId]];
    }

    function getAllListings() external view returns (Listing[] memory) {
        return _listings;
    }

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

    function updateRoyaltyAmount(
        address nftAddress,
        uint256 tokenId,
        uint256 amount
    ) public {
        require(_isListed[nftAddress][tokenId], 'NFT not listed');
        Royalty memory royalty = getRoyalties(nftAddress, tokenId);
        require(royalty.receiver == msg.sender, 'Only royalty receiver');
        royalty.royaltyAmount = amount;
        _setRoyalties(nftAddress, tokenId, royalty);
    }

    function pullFunds(address paymentToken, uint256 amount) public whenNotPaused nonReentrant {
        // Checks
        require(isPaymentToken(paymentToken), 'Payment token not supported');
        require(amount > 0, 'Amount must be greater than 0');
        require(_balances[paymentToken][msg.sender] >= amount, 'Insufficient funds');
        // Effects
        uint256 curBalance = _balances[paymentToken][msg.sender];
        _balances[paymentToken][msg.sender] = curBalance - amount;

        // Integrations
        if (paymentToken == address(0x0)) {
            payable(msg.sender).transfer(amount);
        } else {
            IERC20(paymentToken).transfer(msg.sender, amount);
        }
        assert(_balances[paymentToken][msg.sender] == curBalance - amount);
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }
}
