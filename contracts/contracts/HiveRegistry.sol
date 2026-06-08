// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract HiveRegistry is ReentrancyGuard, Pausable {
    IERC20 public immutable usdcToken;
    address public immutable slashTreasury;
    address public pauser;

    uint256 public constant MINIMUM_STAKE = 1 * 10**6; // 1 USDC minimum stake
    uint256 public constant SLASH_AMOUNT = 500000; // 0.5 USDC slashed per failed QA
    uint256 public constant MAX_SLASH_COUNT = 5; // Model deactivated after 5 slashes

    enum Status { Pending, Approved, Rejected, TimeoutClaimed }

    struct Task {
        address orchestrator;
        address specialist;
        uint256 modelId;
        uint256 amount;
        bytes32 promptHash;
        bytes32 resultHash;
        uint256 createdAt;
        Status status;
    }

    struct Model {
        uint256 id;
        string name;
        string niche;
        uint256 pricePerQuery;
        address wallet;
        bool isActive;
        uint256 stakedAmount;
        uint256 totalTasksCompleted;
        uint256 totalTasksFailed;
        uint256 slashCount;
    }

    // Task state
    uint256 public nextTaskId;
    mapping(uint256 => Task) public tasks;

    // Model Registry state
    uint256 public nextModelId;
    mapping(uint256 => Model) public models;
    mapping(string => uint256[]) private nicheToModelIds;
    mapping(uint256 => uint256) public modelPendingTasks; // tracks pending tasks
    string[] public registeredNiches;
    mapping(string => bool) private nicheExists;

    // Events
    event ModelRegistered(uint256 indexed modelId, string name, string indexed niche, uint256 pricePerQuery, address wallet);
    event ModelUpdated(uint256 indexed modelId, string name, uint256 pricePerQuery);
    event TaskRequested(uint256 indexed taskId, address indexed orchestrator, address indexed specialist, uint256 amount, bytes32 promptHash);
    event TaskApproved(uint256 indexed taskId, bytes32 resultHash);
    event TaskRejected(uint256 indexed taskId);
    event TaskTimedOut(uint256 indexed taskId);
    
    event ModelStaked(uint256 indexed modelId, uint256 amount, uint256 totalStake);
    event ModelUnstaked(uint256 indexed modelId, uint256 amount);
    event ModelSlashed(uint256 indexed modelId, uint256 newSlashCount, uint256 remainingStake);
    event ModelDeactivated(uint256 indexed modelId, string reason);
    event PauserTransferred(address indexed oldPauser, address indexed newPauser);

    constructor(address _usdcToken, address _slashTreasury) {
        require(_usdcToken != address(0), "Invalid token address");
        require(_slashTreasury != address(0), "Invalid treasury address");
        usdcToken = IERC20(_usdcToken);
        slashTreasury = _slashTreasury;
        pauser = msg.sender;
    }

    function pause() external {
        require(msg.sender == pauser, "Only pauser can pause");
        _pause();
    }

    function unpause() external {
        require(msg.sender == pauser, "Only pauser can unpause");
        _unpause();
    }

    function transferPauser(address newPauser) external {
        require(msg.sender == pauser, "Only pauser can transfer");
        require(newPauser != address(0), "New pauser is the zero address");
        address oldPauser = pauser;
        pauser = newPauser;
        emit PauserTransferred(oldPauser, newPauser);
    }

    // Model Registry Functions
    function registerModel(
        string calldata name,
        string calldata niche,
        uint256 pricePerQuery,
        address wallet
    ) external nonReentrant whenNotPaused returns (uint256) {
        require(wallet != address(0), "Invalid wallet address");
        require(bytes(name).length > 0, "Name cannot be empty");
        require(bytes(niche).length > 0, "Niche cannot be empty");

        uint256 modelId = nextModelId++;
        models[modelId] = Model({
            id: modelId,
            name: name,
            niche: niche,
            pricePerQuery: pricePerQuery,
            wallet: wallet,
            isActive: true,
            stakedAmount: 0,
            totalTasksCompleted: 0,
            totalTasksFailed: 0,
            slashCount: 0
        });
        // Note: Orchestrators should prefer staked models

        nicheToModelIds[niche].push(modelId);
        if (!nicheExists[niche]) {
            nicheExists[niche] = true;
            registeredNiches.push(niche);
        }

        emit ModelRegistered(modelId, name, niche, pricePerQuery, wallet);
        return modelId;
    }

    function getRegisteredNiches() external view returns (string[] memory) {
        return registeredNiches;
    }

    function updateModel(uint256 modelId, string calldata name, uint256 pricePerQuery) external {
        Model storage model = models[modelId];
        require(model.wallet == msg.sender, "Only model wallet can update");
        require(model.isActive, "Model is deactivated");
        require(bytes(name).length > 0, "Name cannot be empty");
        model.name = name;
        model.pricePerQuery = pricePerQuery;
        emit ModelUpdated(modelId, name, pricePerQuery);
    }

    function stakeForModel(uint256 modelId, uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be greater than zero");
        Model storage model = models[modelId];
        require(model.wallet == msg.sender, "Only model wallet can stake");
        
        require(usdcToken.transferFrom(msg.sender, address(this), amount), "USDC transfer failed");
        
        model.stakedAmount += amount;
        emit ModelStaked(modelId, amount, model.stakedAmount);
    }

    function unstakeFromModel(uint256 modelId) external nonReentrant whenNotPaused {
        Model storage model = models[modelId];
        require(model.wallet == msg.sender, "Only model wallet can unstake");
        require(!model.isActive || modelPendingTasks[modelId] == 0, "Cannot unstake with active status or pending tasks");
        
        uint256 amount = model.stakedAmount;
        require(amount > 0, "Nothing to unstake");
        
        model.stakedAmount = 0;
        require(usdcToken.transfer(model.wallet, amount), "USDC transfer failed");
        
        emit ModelUnstaked(modelId, amount);
    }

    function _slashModel(uint256 modelId) internal {
        Model storage model = models[modelId];
        model.totalTasksFailed += 1;
        
        uint256 slashAmount = SLASH_AMOUNT;
        if (model.stakedAmount < slashAmount) {
            slashAmount = model.stakedAmount;
        }
        
        if (slashAmount > 0) {
            model.stakedAmount -= slashAmount;
            require(usdcToken.transfer(slashTreasury, slashAmount), "Slash transfer failed");
        }
        
        model.slashCount += 1;
        emit ModelSlashed(modelId, model.slashCount, model.stakedAmount);
        
        if (model.slashCount >= MAX_SLASH_COUNT) {
            model.isActive = false;
            emit ModelDeactivated(modelId, "Max slash count reached");
        } else if (model.stakedAmount < MINIMUM_STAKE && model.isActive) {
            model.isActive = false;
            emit ModelDeactivated(modelId, "Stake below minimum");
        }
    }

    function getModelsByNiche(string calldata niche) external view returns (Model[] memory) {
        uint256[] memory ids = nicheToModelIds[niche];
        uint256 activeCount = 0;
        
        for (uint256 i = 0; i < ids.length; i++) {
            if (models[ids[i]].isActive) {
                activeCount++;
            }
        }

        Model[] memory activeModels = new Model[](activeCount);
        uint256 currentIndex = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            if (models[ids[i]].isActive) {
                activeModels[currentIndex] = models[ids[i]];
                currentIndex++;
            }
        }

        return activeModels;
    }

    // Escrow Functions
    function requestTask(
        address specialist,
        uint256 modelId,
        uint256 amount,
        bytes32 promptHash
    ) external nonReentrant whenNotPaused returns (uint256) {
        require(specialist != address(0), "Invalid specialist address");
        require(amount > 0, "Amount must be greater than zero");

        uint256 taskId = nextTaskId++;
        tasks[taskId] = Task({
            orchestrator: msg.sender,
            specialist: specialist,
            modelId: modelId,
            amount: amount,
            promptHash: promptHash,
            resultHash: bytes32(0),
            createdAt: block.timestamp,
            status: Status.Pending
        });
        modelPendingTasks[modelId] += 1;

        // Transfer USDC from orchestrator to this contract escrow
        require(usdcToken.transferFrom(msg.sender, address(this), amount), "USDC transfer failed");

        emit TaskRequested(taskId, msg.sender, specialist, amount, promptHash);
        return taskId;
    }

    function approveTask(uint256 taskId, bytes32 resultHash) external nonReentrant whenNotPaused {
        Task storage task = tasks[taskId];
        require(task.status == Status.Pending, "Task not pending");
        require(msg.sender == task.orchestrator, "Only orchestrator can approve");

        task.status = Status.Approved;
        task.resultHash = resultHash;
        modelPendingTasks[task.modelId] -= 1;
        models[task.modelId].totalTasksCompleted += 1;

        // Release USDC to specialist
        require(usdcToken.transfer(task.specialist, task.amount), "USDC transfer to specialist failed");

        emit TaskApproved(taskId, resultHash);
    }

    function rejectTask(uint256 taskId) external nonReentrant whenNotPaused {
        Task storage task = tasks[taskId];
        require(task.status == Status.Pending, "Task not pending");
        require(msg.sender == task.orchestrator, "Only orchestrator can reject");

        task.status = Status.Rejected;
        modelPendingTasks[task.modelId] -= 1;

        // Refund USDC to orchestrator
        require(usdcToken.transfer(task.orchestrator, task.amount), "USDC refund to orchestrator failed");

        // Internal slash logic
        _slashModel(task.modelId);

        emit TaskRejected(taskId);
    }

    function claimTimeout(uint256 taskId) external nonReentrant whenNotPaused {
        Task storage task = tasks[taskId];
        require(task.status == Status.Pending, "Task not pending");
        require(msg.sender == task.specialist, "Only specialist can claim timeout");
        require(block.timestamp >= task.createdAt + 300, "Timeout period has not passed"); // 5 minutes

        task.status = Status.TimeoutClaimed;
        modelPendingTasks[task.modelId] -= 1;

        // Release USDC to specialist
        require(usdcToken.transfer(task.specialist, task.amount), "USDC transfer failed");

        emit TaskTimedOut(taskId);
    }
}
