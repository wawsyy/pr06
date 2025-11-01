import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedFHECounter = await deploy("FHECounter", {
    from: deployer,
    log: true,
  });

  console.log(`FHECounter contract: `, deployedFHECounter.address);

  const maxParticipants = 100; // Default max participants for lucky draw
  const deployedLuckyDraw = await deploy("EncryptedLuckyDraw", {
    from: deployer,
    args: [maxParticipants],
    log: true,
  });

  console.log(`EncryptedLuckyDraw contract: `, deployedLuckyDraw.address);
  console.log(`Max participants: `, maxParticipants);
};
export default func;
func.id = "deploy_contracts"; // id required to prevent reexecution
func.tags = ["FHECounter", "EncryptedLuckyDraw"];
