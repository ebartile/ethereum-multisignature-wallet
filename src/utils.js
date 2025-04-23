import {castArray, cloneDeep, isString, keyBy, mapValues, tap} from "lodash-es";
import fs from "fs";
import AsyncLock from "async-lock";

const nonceTimer = 300000;
const nonceCache = {};
const lock = new AsyncLock({timeout: 10000});

/**
 * Map array of objects to key and value
 *
 * @param data
 * @param key
 * @param value
 */
function mapToObject(data, key, value) {
    return mapValues(keyBy(data, key), value);
}

/**
 * Get nonce for the address
 *
 * @param web3
 * @param address
 * @param callback
 * @returns {Promise<*>}
 */
async function nonceTracker(web3, address, callback) {
    if (!nonceCache[address]) nonceCache[address] = {nonce: 0};

    if (nonceCache[address].timer) {
        clearTimeout(nonceCache[address].timer);
    }

    const count = await web3.eth.getTransactionCount(address);
    const nonce = nonceCache[address].nonce > count ? nonceCache[address].nonce : count; // prettier-ignore

    return tap(await callback(nonce), function () {
        nonceCache[address].nonce = nonce + 1;

        nonceCache[address].timer = setTimeout(() => {
            return delete nonceCache[address];
        }, nonceTimer);
    });
}

/**
 * Upsert into array
 *
 * @param collection
 * @param item
 * @param uniq
 */
function upsert(collection, item, uniq) {
    const id = collection.findIndex((o) => uniq(o) === uniq(item));

    if (id >= 0) {
        collection[id] = item;
    } else {
        collection.push(item);
    }
}

/**
 * throw error with status code
 *
 * @param message
 * @param code
 * @returns {Error}
 */
function httpError(message, code = 422) {
    return tap(new Error(message), (error) => (error.status = code));
}

/**
 * Check if value is string and not empty
 *
 * @param value
 * @returns {boolean}
 */
function isValidString(value) {
    return isString(value) && value.length > 0;
}

/**
 * Sign and Send transaction
 *
 * @param web3
 * @param account
 * @param skeleton
 * @param events
 * @returns {Promise<string>}
 */
async function sendTransaction(web3, account, skeleton, events = {}) {
    return await lock.acquire(account.address, async () => {
        return await nonceTracker(web3, account.address, async (nonce) => {
            return await new Promise(function (resolve, reject) {
                events = {
                    onSending: () => null,
                    onSent: () => null,
                    onConfirmation: () => null,
                    onReceipt: () => null,
                    ...events
                };

                if (!skeleton.nonce) skeleton.nonce = nonce;

                account
                    .signTransaction(skeleton)
                    .then(({rawTransaction}) => {
                        return web3.eth
                            .sendSignedTransaction(rawTransaction)
                            .on("sending", events.onSending)
                            .on("sent", events.onSent)
                            .on("confirmation", events.onConfirmation)
                            .on("receipt", events.onReceipt)
                            .on("transactionHash", resolve)
                            .on("error", reject);
                    })
                    .catch(reject);
            });
        });
    });
}

/**
 * Build transaction object
 *
 * @param transaction
 * @param block
 * @returns {Object}
 */
function buildTransaction(transaction, block = null) {
    return {
        hash: transaction.hash,
        from: transaction.from,
        to: transaction.to,
        blockNumber: transaction.blockNumber,
        value: transaction.value,
        confirmations: block ? 1 : 0,
        gasPrice: transaction.gasPrice,
        gasLimit: transaction.gas,
        timestamp: block?.timestamp
    };
}

/**
 * Build token transfer from transaction input
 *
 * @param transaction
 * @param web3
 * @returns {*}
 */
function buildTokenTransfer(transaction, web3) {
    const input = decodeTransferInput(transaction.input, web3);
    const checksum = web3.utils.toChecksumAddress;

    return tap(buildTransaction(transaction), (response) => {
        response.from = checksum(input.from ?? response.from);
        response.to = checksum(input.to);
        response.contract = checksum(transaction.to);
        response.value = input.value;
    });
}

/**
 * Decode transfer input
 *
 * @param input
 * @param web3
 * @returns {{[p: string]: any}}
 */
function decodeTransferInput(input, web3) {
    const methodHash = input.slice(0, 10);
    const params = "0x" + input.slice(10);

    let types = [];

    switch (methodHash) {
        case "0x23b872dd":
            types = [
                {type: "address", name: "from"},
                {type: "address", name: "to"},
                {type: "uint256", name: "value"}
            ];
            break;
        case "0xa9059cbb":
            types = [
                {type: "address", name: "to"},
                {type: "uint256", name: "value"}
            ];
            break;
        default:
            throw httpError("Unknown transfer input.");
    }

    return web3.eth.abi.decodeParameters(types, params);
}

/**
 * Decode transfer events
 *
 * @param logs
 * @param contract
 * @param web3
 * @returns {{[p: string]: string}[]}
 */
function decodeTransferEvents(logs, contract, web3) {
    const signature = "Transfer(address,address,uint256)";
    const eventHash = web3.eth.abi.encodeEventSignature(signature);
    const checksum = web3.utils.toChecksumAddress;

    const types = [
        {indexed: true, name: "from", type: "address"},
        {indexed: true, name: "to", type: "address"},
        {indexed: false, name: "value", type: "uint256"}
    ];

    return castArray(cloneDeep(logs))
        .filter((log) => log.topics.shift() === eventHash)
        .filter((log) => log.address === checksum(contract))
        .map((log) => web3.eth.abi.decodeLog(types, log.data, log.topics));
}

/**
 * Check environment and other preconditions to ensure ethereum-api can start safely
 *
 * @param config
 */
function checkPreconditions(config) {
    if (!isValidString(config.wsProvider)) {
        throw new Error("You need to specify a Web3 Provider.");
    }

    if (
        !isValidString(config.storagePath) ||
        !fs.existsSync(config.storagePath)
    ) {
        throw new Error("You need to specify a valid storage path.");
    }

    if (
        !isValidString(config.mongodbUrl) ||
        !isValidString(config.mongodbName)
    ) {
        throw new Error("You need to specify MongoDB details.");
    }
}

export {
    mapToObject,
    upsert,
    decodeTransferInput,
    decodeTransferEvents,
    httpError,
    sendTransaction,
    buildTokenTransfer,
    buildTransaction,
    checkPreconditions,
    isValidString
};
