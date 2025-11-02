import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { expect } from "chai";
import { EncryptedLuckyDraw, EncryptedLuckyDraw__factory } from "../types";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  admin: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  carol: HardhatEthersSigner;
};

async function deployFixture(maxParticipants: number = 100) {
  const factory = (await ethers.getContractFactory("EncryptedLuckyDraw")) as EncryptedLuckyDraw__factory;
  const contract = (await factory.deploy(maxParticipants)) as EncryptedLuckyDraw;
  const address = await contract.getAddress();
  return { contract, address };
}

describe("EncryptedLuckyDraw", function () {
  let signers: Signers;
  let luckyDraw: EncryptedLuckyDraw;
  let luckyDrawAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { admin: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2], carol: ethSigners[3] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("This test suite runs only against the FHEVM local mock");
      this.skip();
    }

    ({ contract: luckyDraw, address: luckyDrawAddress } = await deployFixture());
  });

  async function encryptId(forSigner: HardhatEthersSigner, clearId: number) {
    return fhevm.createEncryptedInput(luckyDrawAddress, forSigner.address).add32(clearId).encrypt();
  }

  it("registers participants and stores encrypted identifiers", async function () {
    const aliceId = 42;
    const aliceInput = await encryptId(signers.alice, aliceId);
    await luckyDraw.connect(signers.alice).register(aliceInput.handles[0], aliceInput.inputProof);

    expect(await luckyDraw.participantCount()).to.eq(1);

    const encId = await luckyDraw.getEncryptedId(signers.alice.address);
    const clear = await fhevm.userDecryptEuint(FhevmType.euint32, encId, luckyDrawAddress, signers.alice);
    expect(clear).to.eq(aliceId);
  });

  it("performs a draw and updates encrypted win status for every participant", async function () {
    const aliceId = await encryptId(signers.alice, 7);
    const bobId = await encryptId(signers.bob, 15);
    const carolId = await encryptId(signers.carol, 88);

    await luckyDraw.connect(signers.alice).register(aliceId.handles[0], aliceId.inputProof);
    await luckyDraw.connect(signers.bob).register(bobId.handles[0], bobId.inputProof);
    await luckyDraw.connect(signers.carol).register(carolId.handles[0], carolId.inputProof);

    expect(await luckyDraw.participantCount()).to.eq(3);

    await luckyDraw.connect(signers.admin).drawWinner();

    const encWinner = await luckyDraw.getEncryptedWinnerIndex();
    const aliceWinnerIdx = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encWinner,
      luckyDrawAddress,
      signers.alice,
    );
    const winnerIndex = Number(aliceWinnerIdx);
    expect(winnerIndex).to.be.oneOf([0, 1, 2]);

    const winnerHandle = await luckyDraw.getEncryptedWinStatus(
      winnerIndex === 0 ? signers.alice.address : winnerIndex === 1 ? signers.bob.address : signers.carol.address,
    );
    expect(winnerHandle).to.not.eq(ethers.ZeroHash);
  });

  it("prevents duplicate registration", async function () {
    const aliceId = await encryptId(signers.alice, 21);
    await luckyDraw.connect(signers.alice).register(aliceId.handles[0], aliceId.inputProof);

    await expect(
      luckyDraw.connect(signers.alice).register(aliceId.handles[0], aliceId.inputProof),
    ).to.be.revertedWithCustomError(luckyDraw, "AlreadyRegistered");
  });

  it("only allows admin to draw", async function () {
    const aliceId = await encryptId(signers.alice, 3);
    await luckyDraw.connect(signers.alice).register(aliceId.handles[0], aliceId.inputProof);

    await expect(luckyDraw.connect(signers.alice).drawWinner()).to.be.revertedWithCustomError(
      luckyDraw,
      "NotAuthorized",
    );
  });

  describe("Max Participants Limit", function () {
    it("enforces maximum participants limit", async function () {
      const maxParticipants = 3;
      ({ contract: luckyDraw, address: luckyDrawAddress } = await deployFixture(maxParticipants));

      // Register maximum allowed participants
      const aliceId = await encryptId(signers.alice, 1);
      const bobId = await encryptId(signers.bob, 2);
      const carolId = await encryptId(signers.carol, 3);

      await luckyDraw.connect(signers.alice).register(aliceId.handles[0], aliceId.inputProof);
      await luckyDraw.connect(signers.bob).register(bobId.handles[0], bobId.inputProof);
      await luckyDraw.connect(signers.carol).register(carolId.handles[0], carolId.inputProof);

      expect(await luckyDraw.participantCount()).to.eq(maxParticipants);

      // Try to register one more participant - should fail
      const signers_extra = await ethers.getSigners();
      const extraSigner = signers_extra[4];
      const extraId = await fhevm.createEncryptedInput(luckyDrawAddress, extraSigner.address).add32(4).encrypt();

      await expect(
        luckyDraw.connect(extraSigner).register(extraId.handles[0], extraId.inputProof)
      ).to.be.revertedWith("Maximum participants reached");
    });

    it("returns correct max participants value", async function () {
      const maxParticipants = 50;
      ({ contract: luckyDraw, address: luckyDrawAddress } = await deployFixture(maxParticipants));

      expect(await luckyDraw.maxParticipants()).to.eq(maxParticipants);
    });
  });
});


