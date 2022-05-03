// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import '@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol';
import './Storage.sol';

contract MarketplaceProxy is Storage, Proxy {
    event Upgraded(address newAddress);

    constructor(address _currentMarketplace) {
        currentMarketplace = _currentMarketplace;
        protocolWallet = owner();
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(RESERVER_ROLE, msg.sender);
    }

    function upgrade(address _newAddress) public onlyOwner {
        currentMarketplace = _newAddress;
        emit Upgraded(_newAddress);
    }

    function _implementation() internal view override returns (address) {
        return currentMarketplace;
    }
}
