const fs = require("fs");
const hre = require("hardhat");
const { ethers } = hre;

let args = process.argv;
args = args.splice(2, args.length);
let params = {};

for (let i = 0; i < args.length; i += 2) {
    if (args[i][0] !== "-" || args[i][1] !== "-") {
        console.log("Please add '--' for the key");
        process.exit(-1);
    }
    let key = args[i].slice(2, args[i].length);
    params[key] = args[i + 1];
}

if (!params.hasOwnProperty('connector')) {
    console.error("Should include connector params")
    process.exit(-1);
}

if (!params.hasOwnProperty('network')) {
    console.error("Should include network params")
    process.exit(-1);
}

if (!params.hasOwnProperty('gasPrice')) {
    console.error("Should include gas params")
    process.exit(-1);
}

let privateKey = process.env.PRIVATE_KEY;
let provider = new ethers.providers.JsonRpcProvider(hre.config.networks[params['network']].url);
let wallet = new ethers.Wallet(privateKey, provider);

hre.network.name = params['networkName'];
hre.network.config = hre.config.networks[params['networkName']];
hre.network.provider = provider;
let contracts = [];

const parseFile = async (filePath) => {
    const data = fs.readFileSync(filePath, "utf-8");
    let parsedData = data.split("contract ");
    parsedData = parsedData[parsedData.length - 1].split(" ");
    parsedData = parsedData[0];
    return parsedData;
}

const parseDir = async (root, basePath, addPath) => {
    for(let i = 0; i < root.length; i++) {
        addPath = "/" + root[i];
        const dir = fs.readdirSync(basePath + addPath);
        if(dir.indexOf("main.sol") !== -1) {
            const fileData = await parseFile(basePath + addPath + "/main.sol");
            contracts.push(fileData)
        } else {
            await parseDir(dir, basePath + addPath, "");
        }
    }
}

const main = async () => {
    const mainnet = fs.readdirSync("./contracts/mainnet/connectors/");
    const polygon = fs.readdirSync("./contracts/polygon/connectors/");
    let basePathMainnet = "./contracts/mainnet/connectors/";
    let basePathPolygon = "./contracts/polygon/connectors/";

    const connectorName = params['connector'];

    await parseDir(mainnet, basePathMainnet, "");
    await parseDir(polygon, basePathPolygon, "");

    if(contracts.indexOf(connectorName) === -1) {
        throw new Error("can not find the connector!\n" + "supported connector names are:\n" + contracts.join("\n"));
    }
    
    const Connector = await ethers.getContractFactory(connectorName);
    const connector = await Connector.connect(wallet).deploy({ gasPrice: ethers.utils.parseUnits(params['gasPrice'], "gwei") });
    await connector.deployed();

    console.log(`${connectorName} Deployed: ${connector.address}`);
    try {
        await hre.run("verify:verify", {
            address: connector.address,
            constructorArguments: []
        }
        )
    } catch (error) {
        console.log(`Failed to verify: ${connectorName}@${connector.address}`)
        console.log(error)
    }

    return connector.address
}

main()
    .then(() => {
        console.log("Done successfully");
        process.exit(0)
    })
    .catch(err => {
        console.log("error:", err);
        process.exit(1);
    })