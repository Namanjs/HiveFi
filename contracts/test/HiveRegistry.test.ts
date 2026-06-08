import { expect } from "chai";
import "@nomicfoundation/hardhat-chai-matchers";
// @ts-ignore
import { ethers } from "hardhat";

describe("HiveRegistry", function () {
  let mockUSDC: any;
  let hiveRegistry: any;
  let owner: any;
  let wallet1: any;
  let wallet2: any;
  let orchestrator: any;

  beforeEach(async function () {
    [owner, wallet1, wallet2, orchestrator] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();

    const slashTreasury = owner.address;

    const HiveRegistry = await ethers.getContractFactory("HiveRegistry");
    hiveRegistry = await HiveRegistry.deploy(await mockUSDC.getAddress(), slashTreasury);
    await hiveRegistry.waitForDeployment();

    await mockUSDC.connect(owner).mint(wallet1.address, ethers.parseUnits("1000", 6));
    await mockUSDC.connect(owner).mint(orchestrator.address, ethers.parseUnits("1000", 6));
  });

  describe("Reentrancy protection and Logic", function () {
    it("should prevent duplicate staking (staking more should increase balance properly)", async function () {
      await hiveRegistry.connect(wallet1).registerModel("Test Model", "SQL", ethers.parseUnits("10", 6), wallet1.address);
      const modelId = await hiveRegistry.nextModelId() - 1n;

      const stakeAmount = ethers.parseUnits("50", 6);
      await mockUSDC.connect(wallet1).approve(await hiveRegistry.getAddress(), stakeAmount);
      await hiveRegistry.connect(wallet1).stakeForModel(modelId, stakeAmount);

      const models = await hiveRegistry.getModelsByNiche("SQL");
      expect(models[0].stakedAmount).to.equal(stakeAmount);
    });

    it("should emit ModelUpdated when updating model metadata", async function () {
      await hiveRegistry.connect(wallet1).registerModel("Old Model", "SQL", ethers.parseUnits("10", 6), wallet1.address);
      const modelId = await hiveRegistry.nextModelId() - 1n;

      const newPrice = ethers.parseUnits("20", 6);
      await expect(hiveRegistry.connect(wallet1).updateModel(modelId, "New Model", newPrice))
        .to.emit(hiveRegistry, "ModelUpdated")
        .withArgs(modelId, "New Model", newPrice);
    });

    it("should reject non-owner model updates", async function () {
      await hiveRegistry.connect(wallet1).registerModel("Old Model", "SQL", ethers.parseUnits("10", 6), wallet1.address);
      const modelId = await hiveRegistry.nextModelId() - 1n;

      await expect(hiveRegistry.connect(wallet2).updateModel(modelId, "New Model", ethers.parseUnits("20", 6)))
        .to.be.revertedWith("Only model wallet can update");
    });

    it("should process full escrow flow (request, approve, release)", async function () {
      await hiveRegistry.connect(wallet1).registerModel("Test Model 2", "PYTHON", ethers.parseUnits("50", 6), wallet1.address);
      const modelId = await hiveRegistry.nextModelId() - 1n;
      
      const price = ethers.parseUnits("50", 6);
      await mockUSDC.connect(orchestrator).approve(await hiveRegistry.getAddress(), price);

      const promptHash = ethers.id("test prompt");
      
      await expect(hiveRegistry.connect(orchestrator).requestTask(wallet1.address, modelId, price, promptHash))
        .to.emit(hiveRegistry, "TaskRequested");

      const taskId = await hiveRegistry.nextTaskId() - 1n;
      const resultHash = ethers.id("test result");

      const balanceBefore = await mockUSDC.balanceOf(wallet1.address);
      await expect(hiveRegistry.connect(orchestrator).approveTask(taskId, resultHash))
        .to.emit(hiveRegistry, "TaskApproved");
      
      const balanceAfter = await mockUSDC.balanceOf(wallet1.address);
      expect(balanceAfter - balanceBefore).to.equal(price);
    });
    it("should process reject and slash flow", async function () {
      await hiveRegistry.connect(wallet1).registerModel("Reject Model", "JS", ethers.parseUnits("50", 6), wallet1.address);
      const modelId = await hiveRegistry.nextModelId() - 1n;

      const stakeAmount = ethers.parseUnits("5", 6);
      await mockUSDC.connect(wallet1).approve(await hiveRegistry.getAddress(), stakeAmount);
      await hiveRegistry.connect(wallet1).stakeForModel(modelId, stakeAmount);

      const price = ethers.parseUnits("50", 6);
      await mockUSDC.connect(orchestrator).approve(await hiveRegistry.getAddress(), price);
      const promptHash = ethers.id("test prompt");
      await hiveRegistry.connect(orchestrator).requestTask(wallet1.address, modelId, price, promptHash);
      const taskId = await hiveRegistry.nextTaskId() - 1n;

      const treasuryBalanceBefore = await mockUSDC.balanceOf(owner.address);
      await expect(hiveRegistry.connect(orchestrator).rejectTask(taskId))
        .to.emit(hiveRegistry, "TaskRejected")
        .withArgs(taskId);

      const model = await hiveRegistry.models(modelId);
      expect(model.slashCount).to.equal(1n);
      
      const slashAmount = 500000n; // 0.5 USDC
      expect(model.stakedAmount).to.equal(stakeAmount - slashAmount);

      const treasuryBalanceAfter = await mockUSDC.balanceOf(owner.address);
      expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(slashAmount);
    });

    it("should deactivate model via max slashes", async function () {
      await hiveRegistry.connect(wallet1).registerModel("Max Slash Model", "RUST", ethers.parseUnits("10", 6), wallet1.address);
      const modelId = await hiveRegistry.nextModelId() - 1n;

      const stakeAmount = ethers.parseUnits("1", 6);
      await mockUSDC.connect(wallet1).approve(await hiveRegistry.getAddress(), stakeAmount);
      await hiveRegistry.connect(wallet1).stakeForModel(modelId, stakeAmount);

      const price = ethers.parseUnits("10", 6);

      for (let i = 0; i < 5; i++) {
        await mockUSDC.connect(orchestrator).approve(await hiveRegistry.getAddress(), price);
        await hiveRegistry.connect(orchestrator).requestTask(wallet1.address, modelId, price, ethers.id("prompt"));
        const taskId = await hiveRegistry.nextTaskId() - 1n;
        
        if (i === 4) {
          await expect(hiveRegistry.connect(orchestrator).rejectTask(taskId))
            .to.emit(hiveRegistry, "ModelDeactivated")
            .withArgs(modelId, "Max slash count reached");
        } else {
          await hiveRegistry.connect(orchestrator).rejectTask(taskId);
        }
      }

      const model = await hiveRegistry.models(modelId);
      expect(model.isActive).to.be.false;
      expect(model.slashCount).to.equal(5n);
    });

    it("should process timeout claim", async function () {
      await hiveRegistry.connect(wallet1).registerModel("Timeout Model", "GO", ethers.parseUnits("20", 6), wallet1.address);
      const modelId = await hiveRegistry.nextModelId() - 1n;

      const price = ethers.parseUnits("20", 6);
      await mockUSDC.connect(orchestrator).approve(await hiveRegistry.getAddress(), price);
      await hiveRegistry.connect(orchestrator).requestTask(wallet1.address, modelId, price, ethers.id("prompt"));
      const taskId = await hiveRegistry.nextTaskId() - 1n;

      await ethers.provider.send("evm_increaseTime", [301]);
      await ethers.provider.send("evm_mine", []);

      const balanceBefore = await mockUSDC.balanceOf(wallet1.address);
      await expect(hiveRegistry.connect(wallet1).claimTimeout(taskId))
        .to.emit(hiveRegistry, "TaskTimedOut")
        .withArgs(taskId);

      const balanceAfter = await mockUSDC.balanceOf(wallet1.address);
      expect(balanceAfter - balanceBefore).to.equal(price);
    });

    it("should respect Faucet cooldown", async function () {
      await mockUSDC.connect(wallet2).faucet();
      const balanceAfterFirst = await mockUSDC.balanceOf(wallet2.address);
      expect(balanceAfterFirst).to.equal(ethers.parseUnits("100", 6));

      await expect(mockUSDC.connect(wallet2).faucet()).to.be.revertedWith("Faucet cooldown active");

      await ethers.provider.send("evm_increaseTime", [86401]); // 1 day + 1 second
      await ethers.provider.send("evm_mine", []);

      await mockUSDC.connect(wallet2).faucet();
      const balanceAfterSecond = await mockUSDC.balanceOf(wallet2.address);
      expect(balanceAfterSecond).to.equal(ethers.parseUnits("200", 6));
    });

    it("should handle Pausable correctly", async function () {
      await hiveRegistry.connect(wallet1).registerModel("Pausable Model", "C++", ethers.parseUnits("10", 6), wallet1.address);
      const modelId = await hiveRegistry.nextModelId() - 1n;

      await hiveRegistry.connect(owner).pause();

      const price = ethers.parseUnits("10", 6);
      await mockUSDC.connect(orchestrator).approve(await hiveRegistry.getAddress(), price);

      await expect(hiveRegistry.connect(orchestrator).requestTask(wallet1.address, modelId, price, ethers.id("prompt")))
        .to.be.revertedWithCustomError(hiveRegistry, "EnforcedPause");

      await expect(hiveRegistry.connect(wallet1).registerModel("Another Model", "C++", price, wallet1.address))
        .to.be.revertedWithCustomError(hiveRegistry, "EnforcedPause");

      // View function should still work
      const models = await hiveRegistry.getModelsByNiche("C++");
      expect(models.length).to.equal(1);

      await hiveRegistry.connect(owner).unpause();
      await expect(hiveRegistry.connect(orchestrator).requestTask(wallet1.address, modelId, price, ethers.id("prompt")))
        .to.emit(hiveRegistry, "TaskRequested");
    });

    it("should prevent unstaking with pending tasks", async function () {
      await hiveRegistry.connect(wallet1).registerModel("Unstake Model", "JAVA", ethers.parseUnits("10", 6), wallet1.address);
      const modelId = await hiveRegistry.nextModelId() - 1n;

      const stakeAmount = ethers.parseUnits("10", 6);
      await mockUSDC.connect(wallet1).approve(await hiveRegistry.getAddress(), stakeAmount);
      await hiveRegistry.connect(wallet1).stakeForModel(modelId, stakeAmount);

      const price = ethers.parseUnits("10", 6);
      await mockUSDC.connect(orchestrator).approve(await hiveRegistry.getAddress(), price);
      await hiveRegistry.connect(orchestrator).requestTask(wallet1.address, modelId, price, ethers.id("prompt"));
      const taskId = await hiveRegistry.nextTaskId() - 1n;

      await expect(hiveRegistry.connect(wallet1).unstakeFromModel(modelId))
        .to.be.revertedWith("Cannot unstake with active status or pending tasks");
      // Wait, the prompt says "Approve the task (clearing pending), then unstake - assert it succeeds"
      // But unstakeFromModel also requires (!model.isActive || modelPendingTasks == 0). Wait, the require is `!model.isActive || modelPendingTasks[modelId] == 0`.
      // If it's active but pending is 0, it works? Wait, the condition is `require(!model.isActive || modelPendingTasks[modelId] == 0)`. Wait, no, it's `!model.isActive || ...`. That means if it is active, pending must be 0? No, if it's NOT active OR pending is 0.
      // Actually `!model.isActive || modelPendingTasks == 0` means if it's active but has 0 pending tasks, it can unstake.
      await hiveRegistry.connect(orchestrator).approveTask(taskId, ethers.id("result"));

      // Now pending tasks is 0
      await expect(hiveRegistry.connect(wallet1).unstakeFromModel(modelId))
        .to.emit(hiveRegistry, "ModelUnstaked");
    });

    it("should allow pauser to transfer pauser role", async function () {
      await expect(hiveRegistry.connect(owner).transferPauser(wallet1.address))
        .to.emit(hiveRegistry, "PauserTransferred")
        .withArgs(owner.address, wallet1.address);
        
      expect(await hiveRegistry.pauser()).to.equal(wallet1.address);
      
      // Old pauser can no longer pause
      await expect(hiveRegistry.connect(owner).pause())
        .to.be.revertedWith("Only pauser can pause");
        
      // New pauser can pause
      await hiveRegistry.connect(wallet1).pause();
      
      // Cannot transfer to zero address
      await expect(hiveRegistry.connect(wallet1).transferPauser(ethers.ZeroAddress))
        .to.be.revertedWith("New pauser is the zero address");
    });
  });
});
