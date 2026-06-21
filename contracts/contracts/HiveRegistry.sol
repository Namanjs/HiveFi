// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract HiveRegistry is ReentrancyGuard, Pausable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    IERC20 public immutable usdcToken;
    address public immutable slashTreasury;
    address public pauser;
    
    // Configurable platform settings
    uint256 public platformFeeBps = 500; // 5% by default
    uint256 public constant MINIMUM_STAKE = 1 * 10**6; // 1 USDC
    uint256 public constant MAX_SLASH_COUNT = 5;

    // Structs
    struct Model {
        uint256 id;
        string name;
        string niche;
        uint256 maxPricePerToken;
        bool isActive;
    }

    struct Provider {
        uint256 id;
        uint256 modelId;
        address wallet;
        string endpoint;
        uint256 pricePerToken;
        uint256 stakedAmount;
        uint256 totalTasksCompleted;
        uint256 totalTasksFailed;
        uint256 slashCount;
        bool isActive;
    }

    enum TaskMode { CHAT, AUTOMATED }
    enum TaskStatus { Pending, Settled, Rejected, Expired, ForceClaimed }

    struct Task {
        address client;
        address orchestrator;
        uint256 providerId;
        uint256 maxBudget;
        uint256 finalAmount;
        bytes32 promptHash;
        bytes32 resultHash;
        TaskMode mode;
        TaskStatus status;
        uint256 createdAt;
        uint256 providerDeadline;
        uint256 userDeadline;
    }

    // State Variables
    uint256 public nextModelId;
    mapping(uint256 => Model) public models;

    uint256 public nextProviderId;
    mapping(uint256 => Provider) public providers;
    mapping(uint256 => uint256[]) public modelProviders; // modelId => array of providerIds

    uint256 public nextTaskId;
    mapping(uint256 => Task) public tasks;
    mapping(uint256 => uint256) public providerPendingTasks;

    // Events
    event ModelRegistered(uint256 indexed modelId, string name);
    event ProviderRegistered(uint256 indexed providerId, uint256 indexed modelId, address wallet, string endpoint, uint256 pricePerToken);
    event ProviderStaked(uint256 indexed providerId, uint256 amount, uint256 totalStake);
    event ProviderSlashed(uint256 indexed providerId, uint256 slashCount, uint256 remainingStake);
    
    event TaskRequested(uint256 indexed taskId, address indexed client, uint256 indexed providerId, uint256 maxBudget, TaskMode mode);
    event TaskSettled(uint256 indexed taskId, uint256 finalAmount, bytes32 resultHash);
    event TaskRejected(uint256 indexed taskId, uint256 finalAmount);
    event TaskForceClaimed(uint256 indexed taskId, uint256 finalAmount);
    event TaskExpired(uint256 indexed taskId);

    constructor(address _usdcToken, address _slashTreasury) {
        require(_usdcToken != address(0), "Invalid token address");
        require(_slashTreasury != address(0), "Invalid treasury address");
        usdcToken = IERC20(_usdcToken);
        slashTreasury = _slashTreasury;
        pauser = msg.sender;
    }

    modifier onlyPauser() {
        require(msg.sender == pauser, "Only pauser");
        _;
    }

    function transferPauser(address newPauser) external onlyPauser {
        pauser = newPauser;
    }

    function pause() external onlyPauser { _pause(); }
    function unpause() external onlyPauser { _unpause(); }

    function setPlatformFeeBps(uint256 newFeeBps) external onlyPauser {
        require(newFeeBps <= 2000, "Fee too high"); // max 20%
        platformFeeBps = newFeeBps;
    }

    // ═══════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════
    function registerModel(
        string calldata name,
        string calldata niche,
        uint256 maxPricePerToken
    ) external returns (uint256) {
        uint256 modelId = nextModelId++;
        models[modelId] = Model({
            id: modelId,
            name: name,
            niche: niche,
            maxPricePerToken: maxPricePerToken,
            isActive: true
        });

        emit ModelRegistered(modelId, name);
        return modelId;
    }

    // ═══════════════════════════════════════════
    // PROVIDER FUNCTIONS
    // ═══════════════════════════════════════════
    function registerProvider(
        uint256 modelId,
        string calldata endpoint,
        uint256 pricePerToken,
        uint256 initialStake
    ) external nonReentrant whenNotPaused returns (uint256) {
        require(models[modelId].isActive, "Model inactive");
        require(pricePerToken <= models[modelId].maxPricePerToken, "Price exceeds cap");
        require(initialStake >= MINIMUM_STAKE, "Stake below minimum");

        require(usdcToken.transferFrom(msg.sender, address(this), initialStake), "USDC transfer failed");

        uint256 providerId = nextProviderId++;
        providers[providerId] = Provider({
            id: providerId,
            modelId: modelId,
            wallet: msg.sender,
            endpoint: endpoint,
            pricePerToken: pricePerToken,
            stakedAmount: initialStake,
            totalTasksCompleted: 0,
            totalTasksFailed: 0,
            slashCount: 0,
            isActive: true
        });

        modelProviders[modelId].push(providerId);
        emit ProviderRegistered(providerId, modelId, msg.sender, endpoint, pricePerToken);
        emit ProviderStaked(providerId, initialStake, initialStake);
        return providerId;
    }

    function stakeForProvider(uint256 providerId, uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be > 0");
        Provider storage provider = providers[providerId];
        require(provider.wallet == msg.sender, "Only provider wallet");
        
        require(usdcToken.transferFrom(msg.sender, address(this), amount), "USDC transfer failed");
        provider.stakedAmount += amount;
        emit ProviderStaked(providerId, amount, provider.stakedAmount);
    }

    function unstakeFromProvider(uint256 providerId) external nonReentrant whenNotPaused {
        Provider storage provider = providers[providerId];
        require(provider.wallet == msg.sender, "Only provider wallet");
        require(!provider.isActive || providerPendingTasks[providerId] == 0, "Cannot unstake if active or busy");
        
        uint256 amount = provider.stakedAmount;
        require(amount > 0, "Nothing to unstake");
        
        provider.stakedAmount = 0;
        require(usdcToken.transfer(provider.wallet, amount), "USDC transfer failed");
    }

    function updateProviderConfig(uint256 providerId, string calldata endpoint, uint256 pricePerToken) external {
        Provider storage provider = providers[providerId];
        require(provider.wallet == msg.sender, "Only provider wallet");
        require(pricePerToken <= models[provider.modelId].maxPricePerToken, "Price exceeds cap");
        
        provider.endpoint = endpoint;
        provider.pricePerToken = pricePerToken;
    }

    function deactivateProvider(uint256 providerId) external {
        Provider storage provider = providers[providerId];
        require(provider.wallet == msg.sender || msg.sender == pauser, "Unauthorized");
        provider.isActive = false;
    }

    function getActiveProviders(uint256 modelId) external view returns (Provider[] memory) {
        uint256[] memory pIds = modelProviders[modelId];
        uint256 activeCount = 0;
        
        for (uint256 i = 0; i < pIds.length; i++) {
            if (providers[pIds[i]].isActive) {
                activeCount++;
            }
        }

        Provider[] memory activeProviders = new Provider[](activeCount);
        uint256 currentIndex = 0;
        for (uint256 i = 0; i < pIds.length; i++) {
            if (providers[pIds[i]].isActive) {
                activeProviders[currentIndex] = providers[pIds[i]];
                currentIndex++;
            }
        }

        return activeProviders;
    }

    // ═══════════════════════════════════════════
    // TASK FUNCTIONS
    // ═══════════════════════════════════════════
    function createTask(
        address client,
        uint256 providerId,
        uint256 maxBudget,
        bytes32 promptHash,
        TaskMode mode
    ) external nonReentrant whenNotPaused returns (uint256) {
        require(client != address(0), "Invalid client");
        require(maxBudget > 0, "Budget > 0 required");
        Provider storage provider = providers[providerId];
        require(provider.isActive, "Provider inactive");
        require(provider.stakedAmount >= MINIMUM_STAKE, "Provider under-staked");

        // Generate a random UUID-like uint256 by hashing the timestamp, sender, and an incrementing nonce
        uint256 taskId = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, nextTaskId++)));
        uint256 pDeadline = block.timestamp + 30 minutes;
        uint256 uDeadline = mode == TaskMode.CHAT ? pDeadline + 24 hours : 0;

        tasks[taskId] = Task({
            client: client,
            orchestrator: msg.sender,
            providerId: providerId,
            maxBudget: maxBudget,
            finalAmount: 0,
            promptHash: promptHash,
            resultHash: bytes32(0),
            mode: mode,
            status: TaskStatus.Pending,
            createdAt: block.timestamp,
            providerDeadline: pDeadline,
            userDeadline: uDeadline
        });

        providerPendingTasks[providerId] += 1;
        require(usdcToken.transferFrom(client, address(this), maxBudget), "USDC transfer failed");

        emit TaskRequested(taskId, client, providerId, maxBudget, mode);
        return taskId;
    }

    function verifySignature(uint256 taskId, uint256 finalAmount, bytes32 resultHash, bytes memory signature) public view returns (bool) {
        Task storage task = tasks[taskId];
        Provider storage provider = providers[task.providerId];

        // EIP-191 payload: (taskId, finalAmount, resultHash)
        bytes32 hash = keccak256(abi.encodePacked(taskId, finalAmount, resultHash));
        bytes32 ethSignedMessageHash = hash.toEthSignedMessageHash();
        
        return ethSignedMessageHash.recover(signature) == provider.wallet;
    }

    function _distributePayment(uint256 providerId, uint256 finalAmount, uint256 refundAmount, address clientWallet) internal {
        Provider storage provider = providers[providerId];

        uint256 platformCut = (finalAmount * platformFeeBps) / 10000;
        uint256 providerCut = finalAmount - platformCut;

        if (platformCut > 0) require(usdcToken.transfer(slashTreasury, platformCut), "Platform fee transfer failed");
        if (providerCut > 0) require(usdcToken.transfer(provider.wallet, providerCut), "Provider transfer failed");
        if (refundAmount > 0) require(usdcToken.transfer(clientWallet, refundAmount), "Refund transfer failed");
    }

    function settleTask(uint256 taskId, uint256 finalAmount, bytes32 resultHash, bytes memory signature) external nonReentrant whenNotPaused {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Pending, "Not pending");
        require(finalAmount <= task.maxBudget, "Final amount exceeds budget");
        require(verifySignature(taskId, finalAmount, resultHash, signature), "Invalid provider signature");

        if (task.mode == TaskMode.CHAT) {
            require(msg.sender == task.orchestrator || msg.sender == task.client, "Only orchestrator/client can settle CHAT task");
        }

        task.status = TaskStatus.Settled;
        task.finalAmount = finalAmount;
        task.resultHash = resultHash;
        providerPendingTasks[task.providerId] -= 1;
        providers[task.providerId].totalTasksCompleted += 1;

        uint256 refund = task.maxBudget - finalAmount;
        _distributePayment(task.providerId, finalAmount, refund, task.client);

        emit TaskSettled(taskId, finalAmount, resultHash);
    }

    function rejectTask(uint256 taskId, uint256 finalAmount, bytes32 resultHash, bytes memory signature) external nonReentrant whenNotPaused {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Pending, "Not pending");
        require(task.mode == TaskMode.CHAT, "Cannot reject AUTOMATED task");
        require(msg.sender == task.orchestrator || msg.sender == task.client, "Only orchestrator/client can reject");
        require(finalAmount <= task.maxBudget, "Final amount exceeds budget");
        require(verifySignature(taskId, finalAmount, resultHash, signature), "Invalid provider signature");

        task.status = TaskStatus.Rejected;
        task.finalAmount = finalAmount;
        task.resultHash = resultHash;
        providerPendingTasks[task.providerId] -= 1;
        
        _slashProvider(task.providerId);

        uint256 computeFee = (finalAmount * 2000) / 10000;
        uint256 disputeFee = (finalAmount * 500) / 10000;
        uint256 refund = task.maxBudget - computeFee - disputeFee;

        Provider storage provider = providers[task.providerId];
        if (computeFee > 0) require(usdcToken.transfer(provider.wallet, computeFee), "Compute fee transfer failed");
        if (disputeFee > 0) require(usdcToken.transfer(slashTreasury, disputeFee), "Dispute fee transfer failed");
        if (refund > 0) require(usdcToken.transfer(task.client, refund), "Refund transfer failed");

        emit TaskRejected(taskId, finalAmount);
    }

    function forceClaim(uint256 taskId, uint256 finalAmount, bytes32 resultHash, bytes memory signature) external nonReentrant whenNotPaused {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Pending, "Not pending");
        require(task.mode == TaskMode.CHAT, "Only CHAT tasks have force claim");
        require(block.timestamp > task.userDeadline, "User deadline not passed");
        require(finalAmount <= task.maxBudget, "Final amount exceeds budget");
        require(verifySignature(taskId, finalAmount, resultHash, signature), "Invalid provider signature");

        Provider storage provider = providers[task.providerId];
        require(msg.sender == provider.wallet, "Only provider wallet can force claim");

        task.status = TaskStatus.ForceClaimed;
        task.finalAmount = finalAmount;
        task.resultHash = resultHash;
        providerPendingTasks[task.providerId] -= 1;
        providers[task.providerId].totalTasksCompleted += 1;

        uint256 refund = task.maxBudget - finalAmount;
        _distributePayment(task.providerId, finalAmount, refund, task.client);

        emit TaskForceClaimed(taskId, finalAmount);
    }

    function expireTask(uint256 taskId) external nonReentrant whenNotPaused {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Pending, "Not pending");
        require(block.timestamp > task.providerDeadline, "Provider deadline not passed");

        task.status = TaskStatus.Expired;
        providerPendingTasks[task.providerId] -= 1;

        _slashProvider(task.providerId);

        require(usdcToken.transfer(task.client, task.maxBudget), "Refund transfer failed");

        emit TaskExpired(taskId);
    }

    function _slashProvider(uint256 providerId) internal {
        Provider storage provider = providers[providerId];
        provider.totalTasksFailed += 1;
        
        uint256 slashAmount = 500000;
        if (provider.stakedAmount < slashAmount) {
            slashAmount = provider.stakedAmount;
        }
        
        if (slashAmount > 0) {
            provider.stakedAmount -= slashAmount;
            require(usdcToken.transfer(slashTreasury, slashAmount), "Slash transfer failed");
        }
        
        provider.slashCount += 1;
        emit ProviderSlashed(providerId, provider.slashCount, provider.stakedAmount);
        
        if (provider.slashCount >= MAX_SLASH_COUNT || provider.stakedAmount < MINIMUM_STAKE) {
            provider.isActive = false;
        }
    }
}
