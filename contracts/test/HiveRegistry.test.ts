import { expect } from "chai";
import "@nomicfoundation/hardhat-chai-matchers";
import { ethers } from "hardhat";

describe("HiveRegistry", function () {
  let mockUSDC: any;
  let hiveRegistry: any;
  let owner: any;
  let wallet1: any;
  let wallet2: any;
  let orchestrator: any;
  const SIX_DECIMALS = 6;
  const USDC = (n: string) => ethers.parseUnits(n, SIX_DECIMALS);

  async function signTask(providerWallet: any, taskId: bigint, finalAmount: bigint, resultHash: string) {
    const packedHash = ethers.solidityPackedKeccak256(
      ["uint256", "uint256", "bytes32"],
      [taskId, finalAmount, resultHash]
    );
    return providerWallet.signMessage(ethers.getBytes(packedHash));
  }

  async function getTaskIdFromTx(tx: any): Promise<bigint> {
    const receipt = await tx.wait();
    for (const log of receipt.logs) {
      try {
        const parsed = hiveRegistry.interface.parseLog(log);
        if (parsed && parsed.name === "TaskRequested") {
          return parsed.args[0];
        }
      } catch { /* skip non-hiveRegistry logs */ }
    }
    throw new Error("TaskRequested event not found");
  }

  beforeEach(async function () {
    [owner, wallet1, wallet2, orchestrator] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();

    const slashTreasury = owner.address;
    const HiveRegistry = await ethers.getContractFactory("HiveRegistry");
    hiveRegistry = await HiveRegistry.deploy(await mockUSDC.getAddress(), slashTreasury);
    await hiveRegistry.waitForDeployment();

    await mockUSDC.connect(owner).mint(wallet1.address, USDC("1000"));
    await mockUSDC.connect(owner).mint(wallet2.address, USDC("1000"));
    await mockUSDC.connect(owner).mint(orchestrator.address, USDC("1000"));
  });

  async function createRegisteredProvider(modelName: string, niche: string, maxPrice: string, endpoint: string, price: string, stake: string, wallet: any): Promise<bigint> {
    const tx1 = await hiveRegistry.connect(wallet).registerModel(modelName, niche, USDC(maxPrice));
    const receipt1 = await tx1.wait();
    let modelId: bigint;
    for (const log of receipt1.logs) {
      try {
        const parsed = hiveRegistry.interface.parseLog(log);
        if (parsed && parsed.name === "ModelRegistered") {
          modelId = parsed.args[0];
        }
      } catch {}
    }
    await mockUSDC.connect(wallet).approve(await hiveRegistry.getAddress(), USDC(stake));
    const tx2 = await hiveRegistry.connect(wallet).registerProvider(modelId!, endpoint, USDC(price), USDC(stake));
    const receipt2 = await tx2.wait();
    let providerId: bigint;
    for (const log of receipt2.logs) {
      try {
        const parsed = hiveRegistry.interface.parseLog(log);
        if (parsed && parsed.name === "ProviderRegistered") {
          providerId = parsed.args[0];
        }
      } catch {}
    }
    return providerId!;
  }

  describe("Reentrancy protection and Logic", function () {
    it("should prevent duplicate staking (staking more should increase balance properly)", async function () {
      const providerId = await createRegisteredProvider(
        "Test Model", "SQL", "10", "http://localhost:4001", "5", "50", wallet1
      );

      const extraStake = USDC("25");
      await mockUSDC.connect(wallet1).approve(await hiveRegistry.getAddress(), extraStake);
      await hiveRegistry.connect(wallet1).stakeForProvider(providerId, extraStake);

      const provider = await hiveRegistry.providers(providerId);
      expect(provider.stakedAmount).to.equal(USDC("75"));
    });

    it("should process full escrow flow (request, approve, release)", async function () {
      const providerId = await createRegisteredProvider(
        "Test Model 2", "PYTHON", "50", "http://localhost:4002", "5", "10", wallet1
      );

      const maxBudget = USDC("50");
      await mockUSDC.connect(orchestrator).approve(await hiveRegistry.getAddress(), maxBudget);

      const tx = await hiveRegistry.connect(orchestrator).createTask(
        orchestrator.address, providerId, maxBudget, ethers.id("test prompt"), 0
      );
      await expect(tx).to.emit(hiveRegistry, "TaskRequested");

      const taskId = await getTaskIdFromTx(tx);
      const finalAmount = USDC("40");
      const resultHash = ethers.id("test result");

      const signature = await signTask(wallet1, taskId, finalAmount, resultHash);
      const balanceBefore = await mockUSDC.balanceOf(wallet1.address);

      await expect(hiveRegistry.connect(orchestrator).settleTask(taskId, finalAmount, resultHash, signature))
        .to.emit(hiveRegistry, "TaskSettled");

      const balanceAfter = await mockUSDC.balanceOf(wallet1.address);
      const providerCut = finalAmount - (finalAmount * 500n / 10000n);
      expect(balanceAfter - balanceBefore).to.equal(providerCut);
    });

    it("should process reject and slash flow", async function () {
      const providerId = await createRegisteredProvider(
        "Reject Model", "JS", "50", "http://localhost:4003", "5", "5", wallet1
      );

      const maxBudget = USDC("50");
      await mockUSDC.connect(orchestrator).approve(await hiveRegistry.getAddress(), maxBudget);
      const tx = await hiveRegistry.connect(orchestrator).createTask(
        orchestrator.address, providerId, maxBudget, ethers.id("prompt"), 0
      );
      const taskId = await getTaskIdFromTx(tx);

      const finalAmount = USDC("10");
      const resultHash = ethers.id("bad result");
      const signature = await signTask(wallet1, taskId, finalAmount, resultHash);

      const treasuryBalanceBefore = await mockUSDC.balanceOf(owner.address);
      await expect(hiveRegistry.connect(orchestrator).rejectTask(taskId, finalAmount, resultHash, signature))
        .to.emit(hiveRegistry, "TaskRejected");

      const provider = await hiveRegistry.providers(providerId);
      expect(provider.slashCount).to.equal(1n);

      const slashAmount = 500000n;
      expect(provider.stakedAmount).to.equal(USDC("5") - slashAmount);

      const disputeFee = finalAmount * 500n / 10000n;
      const treasuryBalanceAfter = await mockUSDC.balanceOf(owner.address);
      expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(slashAmount + disputeFee);
    });

    it("should deactivate provider via max slashes", async function () {
      const providerId = await createRegisteredProvider(
        "Max Slash Model", "RUST", "10", "http://localhost:4004", "5", "10", wallet1
      );

      for (let i = 0; i < 5; i++) {
        const budget = USDC("10");
        await mockUSDC.connect(orchestrator).approve(await hiveRegistry.getAddress(), budget);
        const tx = await hiveRegistry.connect(orchestrator).createTask(
          orchestrator.address, providerId, budget, ethers.id(`prompt${i}`), 0
        );
        const taskId = await getTaskIdFromTx(tx);

        const finalAmount = USDC("5");
        const resultHash = ethers.id(`result${i}`);
        const signature = await signTask(wallet1, taskId, finalAmount, resultHash);
        await hiveRegistry.connect(orchestrator).rejectTask(taskId, finalAmount, resultHash, signature);
      }

      const provider = await hiveRegistry.providers(providerId);
      expect(provider.isActive).to.be.false;
      expect(provider.slashCount).to.equal(5n);
    });

    it("should process timeout claim", async function () {
      const providerId = await createRegisteredProvider(
        "Timeout Model", "GO", "20", "http://localhost:4005", "5", "10", wallet1
      );

      const maxBudget = USDC("20");
      await mockUSDC.connect(orchestrator).approve(await hiveRegistry.getAddress(), maxBudget);
      const tx = await hiveRegistry.connect(orchestrator).createTask(
        orchestrator.address, providerId, maxBudget, ethers.id("prompt"), 0
      );
      const taskId = await getTaskIdFromTx(tx);

      await ethers.provider.send("evm_increaseTime", [90001]);
      await ethers.provider.send("evm_mine", []);

      const finalAmount = USDC("15");
      const resultHash = ethers.id("result");
      const signature = await signTask(wallet1, taskId, finalAmount, resultHash);

      const balanceBefore = await mockUSDC.balanceOf(wallet1.address);
      await expect(hiveRegistry.connect(wallet1).forceClaim(taskId, finalAmount, resultHash, signature))
        .to.emit(hiveRegistry, "TaskForceClaimed");

      const balanceAfter = await mockUSDC.balanceOf(wallet1.address);
      const providerCut = finalAmount - (finalAmount * 500n / 10000n);
      expect(balanceAfter - balanceBefore).to.equal(providerCut);
    });

    it("should respect Faucet cooldown", async function () {
      await mockUSDC.connect(wallet2).faucet();
      const balanceAfterFirst = await mockUSDC.balanceOf(wallet2.address);
      expect(balanceAfterFirst).to.equal(USDC("1100"));

      await expect(mockUSDC.connect(wallet2).faucet()).to.be.revertedWith("Faucet cooldown active");

      await ethers.provider.send("evm_increaseTime", [86401]);
      await ethers.provider.send("evm_mine", []);

      await mockUSDC.connect(wallet2).faucet();
      const balanceAfterSecond = await mockUSDC.balanceOf(wallet2.address);
      expect(balanceAfterSecond).to.equal(USDC("1200"));
    });

    it("should handle Pausable correctly", async function () {
      const providerId = await createRegisteredProvider(
        "Pausable Model", "C++", "10", "http://localhost:4006", "5", "10", wallet1
      );

      await hiveRegistry.connect(owner).pause();

      const budget = USDC("10");
      await mockUSDC.connect(orchestrator).approve(await hiveRegistry.getAddress(), budget);

      await expect(
        hiveRegistry.connect(orchestrator).createTask(orchestrator.address, providerId, budget, ethers.id("prompt"), 0)
      ).to.be.revertedWithCustomError(hiveRegistry, "EnforcedPause");

      await hiveRegistry.connect(owner).unpause();

      await expect(
        hiveRegistry.connect(orchestrator).createTask(orchestrator.address, providerId, budget, ethers.id("prompt"), 0)
      ).to.emit(hiveRegistry, "TaskRequested");
    });

    it("should prevent unstaking with pending tasks", async function () {
      const providerId = await createRegisteredProvider(
        "Unstake Model", "JAVA", "10", "http://localhost:4007", "5", "10", wallet1
      );

      const maxBudget = USDC("10");
      await mockUSDC.connect(orchestrator).approve(await hiveRegistry.getAddress(), maxBudget);
      const tx = await hiveRegistry.connect(orchestrator).createTask(
        orchestrator.address, providerId, maxBudget, ethers.id("prompt"), 0
      );
      const taskId = await getTaskIdFromTx(tx);

      await expect(
        hiveRegistry.connect(wallet1).unstakeFromProvider(providerId)
      ).to.be.revertedWith("Cannot unstake if active or busy");

      const finalAmount = USDC("8");
      const resultHash = ethers.id("result");
      const signature = await signTask(wallet1, taskId, finalAmount, resultHash);
      await hiveRegistry.connect(orchestrator).settleTask(taskId, finalAmount, resultHash, signature);

      await expect(hiveRegistry.connect(wallet1).unstakeFromProvider(providerId))
        .to.not.be.reverted;
    });

    it("should allow pauser to transfer pauser role", async function () {
      await hiveRegistry.connect(owner).transferPauser(wallet1.address);
      expect(await hiveRegistry.pauser()).to.equal(wallet1.address);

      await expect(hiveRegistry.connect(owner).pause())
        .to.be.revertedWith("Only pauser");

      await hiveRegistry.connect(wallet1).pause();
      await hiveRegistry.connect(wallet1).unpause();
    });
  });
});
