const express = require("express");
const app = express();
const dotenv = require("dotenv").config();
const axios = require('axios');
const AES = require("crypto-js/aes");
const enc = require("crypto-js/enc-utf8");
const { Readable } = require('stream');


function bufferToStream(binary) {

    const readableInstanceStream = new Readable({
      read() {
        this.push(binary);
        this.push(null);
      }
    });

    return readableInstanceStream;
}

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

function decryptString(encStr, key) {
    const decrypted = AES.decrypt(encStr, key);
    return decrypted.toString(enc.Utf8);
  }

function decrypt(contents, key) {
    return convertArrayForDecrypt(AES.decrypt(contents, key));
    
    
}

function convertArrayForDecrypt(sourceArray) {
    if (!sourceArray.words) {
      console.error("Incompatible Array Conversion!");
      return new Uint8Array(0);
    } else {
      const wordsLength = sourceArray.words.length;
      const u8_array = new Uint8Array(wordsLength << 2);
      let offset = 0;
      for (let i = 0; i < wordsLength; i++) {
        const word = sourceArray.words[i];
        u8_array[offset++] = word >> 24;
        u8_array[offset++] = (word >> 16) & 0xff;
        u8_array[offset++] = (word >> 8) & 0xff;
        u8_array[offset++] = word & 0xff;
      }
      return u8_array;
    }
  }

async function main() {
    const httpUrl = process.env.SECRET_REST_URL;

    // Use key created in tutorial #2
    const mnemonic = process.env.MNEMONIC;
  
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


    app.get('/*', (req, res) => {

        let chunks = req.path.split('/');

        let p = req.path.substring(chunks[1].length + 1);

        let msg = {get_file: {address: chunks[1], behalf: accAddress, key: process.env.VK, path: p}};
 


        client.queryContractSmart(process.env.CONTRACT, msg).then((response) => {
            let data = JSON.parse(response.file.contents);

            

            let ipfs = data.cid;

            axios({
                method: 'get',
                url: 'https://node.marstonconnell.xyz/download?cid=' + ipfs,
                responseType: 'blob'
            }).then((resp) => {


                const [name, content] = resp.data.split('\n')
                const decryptName = decryptString(name, data.key);
                const decryptContent = decrypt(content, data.key);
                // const file = new File([decryptContent], decryptName);


                let s = bufferToStream(Buffer.from(decryptContent));
                s.pipe(res);
                // res.sendStatus(200);
                    
                // res.send(resp.data);
            });

            // res.status(200).send(response);
        }).catch((response) => {
            res.sendStatus(404);
        });
    });

    app.listen(4000, () => {
        console.log("app listening at 4000");
    });
}

main();