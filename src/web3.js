import Web3 from "web3";
import {buildTransaction, httpError, sendTransaction} from "./utils.js";
import {Token} from "./token.js";

const WebsocketProvider = Web3.providers.WebsocketProvider;

/**
 * Create Web3 instance
 *
 * @param config
 * @returns {Promise<Web3>}
 */
async function createWeb3(config) {
    const instance = new Web3(
        new WebsocketProvider(config.wsProvider, {
            clientConfig: {
                keepalive: true,
                maxReceivedFrameSize: 100000000,
                maxReceivedMessageSize: 100000000,
                keepaliveInterval: 60000
            }
        })
    );

    const stopProcessIfDisconnected = () => {
        if (!instance.currentProvider.connected) {
            process.kill(process.pid, "SIGTERM");
        }
    };

    if (process.env.NODE_ENV !== "development") {
        setInterval(stopProcessIfDisconnected, 5000);
    }

    return instance;
}

/**
 * Get transaction from the blockchain
 *
 * @param web3
 * @param hash
 */
async function getTransaction(web3, hash) {
    const transaction = await web3.eth.getTransaction(hash);
    if (!transaction?.hash) throw httpError("Transaction does not exists.");

    const receipt = await web3.eth.getTransactionReceipt(hash);
    const response = buildTransaction(transaction);

    if (transaction.blockNumber && receipt?.status) {
        const current = await web3.eth.getBlockNumber();
        const block = await web3.eth.getBlock(transaction.blockNumber);
        response.confirmations = current - transaction.blockNumber;
        response.timestamp = block.timestamp;
    }

    return response;
}

function injectWeb3(app, web3, storage) {
    app.use(function (req, res, next) {
        req.storage = storage;

        req.Wallet = storage.Wallet;
        req.Address = storage.Address;
        req.Config = storage.Config;

        req.utils = web3.utils;
        req.accounts = web3.eth.accounts;
        req.eth = web3.eth;

        req.getTransaction = async function (hash) {
            return await getTransaction(web3, hash);
        };

        req.useToken = function (address) {
            return new Token(web3, address);
        };

        req.sendTransaction = async function (account, skeleton, events) {
            return await sendTransaction(web3, account, skeleton, events);
        };

        req.checkAvailability = async function () {
            if (!web3.currentProvider.connected) {
                throw httpError("Client is unavailable.");
            }
        };

        return next();
    });
}

export {createWeb3, injectWeb3};
