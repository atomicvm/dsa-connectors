const { expect } = require("chai");
const hre = require("hardhat");
const abis = require("../../scripts/constant/abis");
const addresses = require("../../scripts/constant/addresses");
const deployAndEnableConnector = require("../../scripts/deployAndEnableConnector");
const getMasterSigner = require("../../scripts/getMasterSigner");
const buildDSAv2 = require("../../scripts/buildDSAv2");
const ConnectV2AaveV1 = require("../../artifacts/contracts/mainnet/connectors/aave/v1/main.sol/ConnectV2AaveV1.json");
const { parseEther } = require("@ethersproject/units");
const encodeSpells = require("../../scripts/encodeSpells");
const tokens = require("../../scripts/constant/tokens");
const constants = require("../../scripts/constant/constant");
const addLiquidity = require("../../scripts/addLiquidity");
const { ethers } = hre;

const ALCHEMY_ID = process.env.ALCHEMY_ID;

describe("Aave V1", function() {
  const connectorName = "AAVEV1-TEST-A";

  let wallet0, wallet1;
  let dsaWallet0;
  let instaConnectorsV2;
  let connector;
  let masterSigner;

  before(async () => {
    try {
      await hre.network.provider.request({
        method: "hardhat_reset",
        params: [
          {
            forking: {
              jsonRpcUrl: hre.config.networks.hardhat.forking.url,
              blockNumber: 12796965,
            },
          },
        ],
      });
      [wallet0, wallet1] = await ethers.getSigners();
      masterSigner = await getMasterSigner();
      instaConnectorsV2 = await ethers.getContractAt(
        abis.core.connectorsV2,
        addresses.core.connectorsV2
      );
      connector = await deployAndEnableConnector({
        connectorName,
        contractArtifact: ConnectV2AaveV1,
        signer: masterSigner,
        connectors: instaConnectorsV2,
      });
      console.log("Connector address", connector.address);
    } catch (err) {
      console.log("error", err);
    }
  });

  it("should have contracts deployed", async () => {
    expect(!!instaConnectorsV2.address).to.be.true;
    expect(!!connector.address).to.be.true;
    expect(!!masterSigner.address).to.be.true;
  });

  describe("DSA wallet setup", function() {
    it("Should build DSA v2", async function() {
      dsaWallet0 = await buildDSAv2(wallet0.address);
      expect(!!dsaWallet0.address).to.be.true;
    });

    it("Deposit ETH into DSA wallet", async function() {
      await wallet0.sendTransaction({
        to: dsaWallet0.address,
        value: parseEther("10"),
      });
      expect(await ethers.provider.getBalance(dsaWallet0.address)).to.be.gte(
        parseEther("10")
      );
    });
  });

  describe("Main", function() {
    it("should deposit ETH in Aave V1", async function() {
      const amt = parseEther("1");
      const spells = [
        {
          connector: connectorName,
          method: "deposit",
          args: [tokens.eth.address, amt, 0, 0],
        },
      ];

      const tx = await dsaWallet0
        .connect(wallet0)
        .cast(...encodeSpells(spells), wallet1.address);

      await tx.wait();

      expect(await ethers.provider.getBalance(dsaWallet0.address)).to.eq(
        parseEther("9")
      );
    });

    it("Should borrow and payback DAI from Aave V1", async function() {
      const amt = parseEther("100"); // 100 DAI

      // add a little amount of dai to cover any shortfalls
      await addLiquidity("dai", dsaWallet0.address, parseEther("1"));

      const spells = [
        {
          connector: connectorName,
          method: "borrow",
          args: [tokens.dai.address, amt, 0, 0],
        },
        {
          connector: connectorName,
          method: "payback",
          // FIXME: we need to pass max_value because of roundoff/shortfall errors
          args: [tokens.dai.address, constants.max_value, 0, 0],
        },
      ];

      const tx = await dsaWallet0
        .connect(wallet0)
        .cast(...encodeSpells(spells), wallet1.address);
      await tx.wait();
      expect(await ethers.provider.getBalance(dsaWallet0.address)).to.be.lte(
        ethers.utils.parseEther("9")
      );
    });

    it("Should deposit all ETH in Aave V1", async function() {
      const spells = [
        {
          connector: connectorName,
          method: "deposit",
          args: [tokens.eth.address, constants.max_value, 0, 0],
        },
      ];

      const tx = await dsaWallet0
        .connect(wallet0)
        .cast(...encodeSpells(spells), wallet1.address);
      await tx.wait();
      expect(await ethers.provider.getBalance(dsaWallet0.address)).to.be.lte(
        ethers.utils.parseEther("0")
      );
    });

    it("Should withdraw all ETH from Aave V1", async function() {
      const spells = [
        {
          connector: connectorName,
          method: "withdraw",
          args: [tokens.eth.address, constants.max_value, 0, 0],
        },
      ];

      const tx = await dsaWallet0
        .connect(wallet0)
        .cast(...encodeSpells(spells), wallet1.address);
      await tx.wait();
      expect(await ethers.provider.getBalance(dsaWallet0.address)).to.be.gte(
        ethers.utils.parseEther("10")
      );
    });
  });
});
