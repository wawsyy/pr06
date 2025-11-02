import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("task:address", "Print the EncryptedLuckyDraw address").setAction(async function (_args: TaskArguments, hre) {
  const { deployments } = hre;
  const deployment = await deployments.get("EncryptedLuckyDraw");
  console.log(`EncryptedLuckyDraw address: ${deployment.address}`);
});

task("task:info", "Print contract information").setAction(async function (_args: TaskArguments, hre) {
  const { ethers, deployments } = hre;
  const deployment = await deployments.get("EncryptedLuckyDraw");
  const contract = await ethers.getContractAt("EncryptedLuckyDraw", deployment.address);

  const admin = await contract.admin();
  const participantCount = await contract.participantCount();
  const maxParticipants = await contract.maxParticipants();
  const lastDrawTimestamp = await contract.lastDrawTimestamp();

  console.log("=== Contract Information ===");
  console.log(`Address: ${deployment.address}`);
  console.log(`Admin: ${admin}`);
  console.log(`Participants: ${participantCount}/${maxParticipants}`);
  console.log(`Last Draw: ${lastDrawTimestamp > 0 ? new Date(Number(lastDrawTimestamp) * 1000).toISOString() : "Never"}`);
});

task("task:register", "Register a participant with an encrypted identifier")
  .addParam("id", "The clear participant identifier (uint32)")
  .addOptionalParam("address", "Optionally specify the contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    const clearId = parseInt(taskArguments.id, 10);
    if (!Number.isInteger(clearId) || clearId < 0 || clearId > 2 ** 32 - 1) {
      throw new Error("--id must be an integer between 0 and 2^32 - 1");
    }

    const deployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("EncryptedLuckyDraw");

    const signers = await ethers.getSigners();
    const participant = signers[0];

    const encryptedInput = await fhevm
      .createEncryptedInput(deployment.address, participant.address)
      .add32(clearId)
      .encrypt();

    const contract = await ethers.getContractAt("EncryptedLuckyDraw", deployment.address);
    const tx = await contract
      .connect(participant)
      .register(encryptedInput.handles[0], encryptedInput.inputProof);
    console.log(`Wait for tx ${tx.hash}...`);
    await tx.wait();

    console.log(`Participant ${participant.address} registered with encrypted id ${clearId}`);
  });

task("task:draw", "Draw a winner (admin only)")
  .addOptionalParam("address", "Optionally specify the contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;
    const deployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("EncryptedLuckyDraw");

    const signers = await ethers.getSigners();
    const admin = signers[0];
    const contract = await ethers.getContractAt("EncryptedLuckyDraw", deployment.address);

    const tx = await contract.connect(admin).drawWinner();
    console.log(`Wait for tx ${tx.hash}...`);
    await tx.wait();

    console.log("Draw completed.");
  });

task("task:decrypt-winner", "Decrypt the latest winner index")
  .addOptionalParam("address", "Optionally specify the contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const deployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("EncryptedLuckyDraw");
    const contract = await ethers.getContractAt("EncryptedLuckyDraw", deployment.address);

    const signers = await ethers.getSigners();
    const viewer = signers[0];

    const encWinner = await contract.getEncryptedWinnerIndex();
    if (encWinner === ethers.ZeroHash) {
      console.log("No draw executed yet.");
      return;
    }

    const clearWinner = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encWinner,
      deployment.address,
      viewer,
    );

    console.log(`Encrypted winner index: ${encWinner}`);
    console.log(`Clear winner index    : ${clearWinner}`);
  });

task("task:decrypt-status", "Decrypt the latest win status for a participant")
  .addParam("participant", "Participant address to query")
  .addOptionalParam("address", "Optionally specify the contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const deployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("EncryptedLuckyDraw");
    const contract = await ethers.getContractAt("EncryptedLuckyDraw", deployment.address);

    const signer = await ethers.getSigner(taskArguments.participant);
    const encStatus = await contract.getEncryptedWinStatus(taskArguments.participant);

    const clearStatus = await fhevm.userDecryptEbool(
      FhevmType.ebool,
      encStatus,
      deployment.address,
      signer,
    );

    console.log(`Encrypted status: ${encStatus}`);
    console.log(`Clear status    : ${clearStatus}`);
  });
