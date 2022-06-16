const express = require("express");
const app = express();
const dotenv = require("dotenv").config();
const {
    EnigmaUtils, Secp256k1Pen, SigningCosmWasmClient, pubkeyToAddress, encodeSecp256k1Pubkey
  } = require("secretjs");
const customFees = {
    upload: {
        amount: [{ amount: "2000000", denom: "uscrt" }],
        gas: "2000000",
    },
    init: {
        amount: [{ amount: "500000", denom: "uscrt" }],
        gas: "500000",
    },
    exec: {
        amount: [{ amount: "500000", denom: "uscrt" }],
        gas: "500000",
    },
    send: {
        amount: [{ amount: "80000", denom: "uscrt" }],
        gas: "80000",
    },
}

async function main() {
    const httpUrl = process.env.SECRET_REST_URL;

    // Use key created in tutorial #2
    const mnemonic = process.env.PERSONAL_PHRASE;
  
    // A pen is the most basic tool you can think of for signing.
    // This wraps a single keypair and allows for signing.
    const signingPen = await Secp256k1Pen.fromMnemonic(mnemonic);
  
    // Get the public key
    const pubkey = encodeSecp256k1Pubkey(signingPen.pubkey);
  
    // get the wallet address
    const accAddress = pubkeyToAddress(pubkey, 'secret');
  
    const txEncryptionSeed = EnigmaUtils.GenerateNewSeed();
    
    const client = new SigningCosmWasmClient(
        httpUrl,
        accAddress,
        (signBytes) => signingPen.sign(signBytes),
        txEncryptionSeed, customFees
    );
    console.log(`Wallet address=${accAddress}`);

   

        
        const handleMsg = { allow_read: {address: "secret1604pptjt39jmk5h495mlsylpp694739njytss9", path: "secret1w9rz84q02s8p9l5xkgcdvlz2eu0ajkkydeuavj/beta/index.html"} };
        client.execute(process.env.CONTRACT, handleMsg).then((response) => {
            console.log(response);
        });
}

main();