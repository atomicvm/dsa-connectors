const hre = require("hardhat");
const { ethers, deployments, getUnnamedAccounts } = hre;
const { deploy } = deployments;


async function main() {
    
    const deployer = (await getUnnamedAccounts())[0]

    const connector = "ConnectV2InstaPoolV3Avalanche"

    const connectorInstance = await deploy(connector, {
        from: deployer,
    })
    console.log(`${connector} deployed: `, connectorInstance.address);

    await hre.run("sourcify", {
        address: connectorInstance.address,
    })
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });