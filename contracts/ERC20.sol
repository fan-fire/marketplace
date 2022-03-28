// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract ERC20Mock is ERC20 {
    constructor() ERC20('ABC', 'ABC') {
        _mint(msg.sender, 10000000 * 10**18);
    }
}
