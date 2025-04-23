import axios from "axios";
import axiosRetry from "axios-retry";
import {buildTokenTransfer, buildTransaction} from "./utils.js";
import {castArray, forOwn, isArray, isEmpty, isObject} from "lodash-es";

axiosRetry(axios, {
    shouldResetTimeout: true,
    retries: 15,
    retryDelay: (count) => {
        return Math.pow(2, count) * 1000;
    },
    retryCondition: (error) => {
        return !isEmpty(error);
    }
});

axios.interceptors.request.use(function (config) {
    config.headers["Content-Type"] = "application/json";
    config.headers["Accept"] = "application/json";
    return config;
});

class BlockListener {
    handlers = {};

    constructor(web3, storage) {
        this.web3 = web3;
        this.storage = storage;
    }

    async initialize() {
        const wallets = await this.storage.Wallet.find();
        wallets.forEach((o) => this.registerHandler(o));
        this.startListener();
    }

    registerHandler(wallet) {
        this.handlers[wallet._id] = new BlockHandler(this.web3, wallet);
    }

    restartListener() {
        this.stopListener();
        this.startListener();
    }

    startListener() {
        this.subscription = this.web3.eth.subscribe("newBlockHeaders");

        this.subscription.on("connected", () => {
            console.info("[events] Started block listener.");
        });

        this.subscription.on("error", () => {
            timeout(5000).then(() => this.restartListener());
        });

        this.subscription.on("data", (block) => {
            this.process(block.number).catch(console.error);
        });
    }

    stopListener() {
        this.subscription?.unsubscribe((e, status) => {
            if (status) console.log("[events] Stopped block listener.");
        });
    }

    async process(blockNumber) {
        const block = await this.web3.eth.getBlock(blockNumber, true);
        forOwn(this.handlers, (handler) => handler.handle(block));
    }
}

class BlockHandler {
    constructor(web3, wallet) {
        this.web3 = web3;
        this.wallet = wallet;

        console.info(`[events] Registered Handler: ${wallet._id}`);
    }

    async handle(block) {
        if (!isArray(block?.transactions)) return;
        const {transaction, tokenTransfer} = this.wallet.events;

        for (const tokenTransferItem of tokenTransfer) {
            await this.handleTokenTransfer(block, tokenTransferItem);
        }

        await this.handleTransaction(block, transaction);
    }

    async handleTransaction(block, config) {
        if (!config?.webhook) return;
        const transactions = this.getTransactions(block);

        const eventParsers = transactions.map(async (transaction) => {
            if (await this.hasAddress(transaction.to)) {
                return buildTransaction(transaction, block);
            }

            throw new Error("Unknown value transfer");
        });

        (await Promise.allSettled(eventParsers))
            .filter((result) => result.status === "fulfilled")
            .forEach(({value: transfer}) => {
                this.broadcast(config.webhook, transfer);
            });
    }

    async handleTokenTransfer(block, config) {
        if (!config?.webhook) return;
        const transactions = this.getTransactions(block);

        const eventParsers = transactions.map(async (transaction) => {
            if (transaction.to !== this.checksum(config.contract)) {
                throw new Error("Unknown contract address.");
            }

            const transfer = buildTokenTransfer(transaction, this.web3);
            if (await this.hasAddress(transfer.to)) return transfer;

            throw new Error("Unknown token transfer");
        });

        (await Promise.allSettled(eventParsers))
            .filter((result) => result.status === "fulfilled")
            .forEach(({value: transfer}) => {
                this.broadcast(config.webhook, transfer);
            });
    }

    getTransactions(block) {
        return castArray(block.transactions).filter(isObject);
    }

    broadcast(destination, transaction) {
        return axios
            .post(destination, transaction)
            .then(() => this.logTransaction(transaction.hash))
            .catch((e) => console.error(e));
    }

    logTransaction = (hash) => {
        console.info(`[events] ${this.wallet._id} - ${hash}`);
    };

    checksum = (address) => this.web3.utils.toChecksumAddress(address);

    async hasAddress(address) {
        return await this.wallet.hasAddress(address);
    }
}

/**
 * Promise timeout
 *
 * @param ms
 * @returns {Promise<unknown>}
 */
function timeout(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Start event listeners
 *
 * @param app
 * @param web3
 * @param storage
 */
async function startEvent(app, web3, storage) {
    const listener = new BlockListener(web3, storage);

    await listener.initialize();

    app.use(function (req, res, next) {
        req.registerBlockHandler = function (wallet) {
            listener.registerHandler(wallet);
        };

        return next();
    });

    return () => listener.stopListener();
}

export {startEvent};
