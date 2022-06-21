// const express = require("express");
// const app = express();
// const dotenv = require("dotenv").config();
// const axios = require('axios');
const AES = require("crypto-js/aes");
const enc = require("crypto-js/enc-utf8");
// const { Readable } = require('stream');

import Express from 'express'
import Axios from 'axios'
import DotEnv from 'dotenv'
import CORS from 'cors'

import { Readable } from 'stream'
import {GatewayStorageContract, UserStorageContract} from 'huskyjs'

DotEnv.config()
const app = Express()
app.use(CORS())

const contract = new GatewayStorageContract({
    scrtContractAddr: process.env.SCRT_CONTRACT || '',
    scrtMnemonic: process.env.SCRT_MNMONIC || '',
    scrtRestUrl: process.env.SECRET_REST_URL || ''
})

const port = process.env.PORT || 3042
const nodeUrl = 'jackal.squirrellogic.com'

app.get('/:target/:path(.{0,})', (req, res) => {

    let msg = {
        getContentsMsg: {
            behalf: precessDesto(req.params.target),
            key: process.env.VK,
            path: `${(true) ? '/www' : ''}/${req.params.path}`
        }
    }



    contract.getContents(getContentsMsg).then((response: any) => {
        let data = JSON.parse(response.file.contents);

        Axios({
            method: 'get',
            url: `https://${nodeUrl}/download?cid=${data.cid}`,
            responseType: 'blob'
        })
            .then((resp) => {

                //todo this all needs to be reworked
                const [_, content] = resp.data.split('\n')
                const decryptContent = decrypt(content, data.key);

                res.set('Cache-control', 'public, max-age=480');
                let s = bufferToStream(Buffer.from(decryptContent));
                s.pipe(res);
            })
            .catch(() => {
                res.sendStatus(404)
            })
    })
})
app.listen(port, () => {
    console.log(`app listening at ${port}`)
})

/** Functions */

function bufferToStream (binary: Buffer) {

    const readableInstanceStream = new Readable({
      read() {
        this.push(binary);
        this.push(null);
      }
    });

    return readableInstanceStream;
}
function precessDesto (target: string) {
    if (!target.length) {
        throw new Error('No Target')
    } else {
        return (target.startsWith('secret1')) ? target : '' /** todo add RNS logic */
    }
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
        



        let msg = {get_contents: {behalf: accAddress, key: process.env.VK, path: req.path.substring(1)}};
 


        client.queryContractSmart(process.env.CONTRACT, msg).then((response) => {
            let data = JSON.parse(response.file.contents);

            

            let ipfs = data.cid;

            axios({
                method: 'get',
                url: 'https://jackal.squirrellogic.com/download?cid=' + ipfs,
                responseType: 'blob'
            }).then((resp) => {


                const [name, content] = resp.data.split('\n')
                const decryptName = decryptString(name, data.key);
                const decryptContent = decrypt(content, data.key);
                // const file = new File([decryptContent], decryptName);

                res.set('Cache-control', 'public, max-age=480');
                let s = bufferToStream(Buffer.from(decryptContent));
                s.pipe(res);
                // res.sendStatus(200);
                    
                // res.send(resp.data);
            }).catch(() => {
                res.sendStatus(404);
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