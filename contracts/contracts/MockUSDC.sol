// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockUSDC is ERC20, Ownable {
    uint256 public constant FAUCET_AMOUNT = 100 * 10**6; // 100 USDC
    uint256 public constant FAUCET_COOLDOWN = 1 days;
    mapping(address => uint256) public lastFaucetTime;

    constructor() ERC20("Mock USDC", "USDC") Ownable(msg.sender) {
        // No initial supply minted. Rely purely on public mint or faucet.
    }

    // Override decimals to match USDC (6 decimals)
    function decimals() public view virtual override returns (uint8) {
        return 6;
    }

    // Public mint function for easy testnet funding during hackathon demo
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    function faucet() external {
        require(block.timestamp >= lastFaucetTime[msg.sender] + FAUCET_COOLDOWN, "Faucet cooldown active");
        lastFaucetTime[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
    }
}
