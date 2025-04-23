import bodyParser from "body-parser";
import {checkSchema, validationResult} from "express-validator";
import {httpError} from "./utils.js";
import {assign, defaultTo, isEmpty, keyBy, mapValues} from "lodash-es";

//--------------------------
// BEGIN REQUEST HANDLERS
//--------------------------
const ping = {
    handle: function () {
        return {status: "ethereum-api is running."};
    }
};

const createWallet = {
    handle: async function (req) {
        await req.checkAvailability();

        const password = req.body.password;

        const wallet = await req.Wallet.generate(password);

        return {id: wallet._id, address: wallet.address};
    },
    schema: {
        password: {
            isString: true,
            isLength: {options: {min: 10}},
            notEmpty: true
        }
    }
};

const createWalletAddress = {
    handle: async function (req) {
        await req.checkAvailability();

        const uuid = req.params.id;
        const password = req.body.password;

        const wallet = await req.Wallet.findOrFail(uuid);
        const address = await wallet.generateAddress(password);

        return {id: address._id, address: address.address};
    },
    schema: {
        password: {isString: true, notEmpty: true}
    }
};

const getWallet = {
    handle: async function (req) {
        await req.checkAvailability();

        const uuid = req.params.id;

        const wallet = await req.Wallet.findOrFail(uuid);

        return {id: wallet._id, address: wallet.address};
    }
};

const createTransactionWebhook = {
    handle: async function (req) {
        await req.checkAvailability();

        const uuid = req.body.wallet;
        const webhook = req.body.url;

        const wallet = await req.Wallet.findOrFail(uuid);
        await wallet.setTransactionEvent({webhook});

        req.registerBlockHandler(wallet);

        return {id: uuid, status: true};
    },
    schema: {
        wallet: {isString: true, notEmpty: true},
        url: {isString: true, isURL: true}
    }
};

const consolidateWallet = {
    handle: async function (req) {
        await req.checkAvailability();

        const uuid = req.params.id;
        const password = req.body.password;
        const address = req.body.address;
        const toBN = req.utils.toBN;

        const wallet = await req.Wallet.findOrFail(uuid);
        const source = await wallet.findAddressOrFail(address);

        const rootAccount = wallet.decryptAccount(password);
        const fromAccount = source.decryptAccount(password);

        const gasPrice = toBN(await req.eth.getGasPrice());
        const estimateFee = gasPrice.muln(21000);
        const balance = toBN(await req.eth.getBalance(fromAccount.address));
        const transferable = balance.sub(estimateFee);

        if (transferable.isZero() || transferable.isNeg()) {
            throw httpError("Not enough amount to consolidate.", 409);
        }

        const hash = await req.sendTransaction(fromAccount, {
            value: transferable,
            to: rootAccount.address,
            gasPrice: gasPrice,
            gas: toBN(21000)
        });

        return await req.getTransaction(hash);
    },
    schema: {
        password: {isString: true, notEmpty: true},
        address: {isString: true, notEmpty: true}
    }
};

const walletSend = {
    handle: async function (req) {
        await req.checkAvailability();

        const uuid = req.params.id;
        const password = req.body.password;
        const address = req.body.address;
        const toBN = req.utils.toBN;

        const wallet = await req.Wallet.findOrFail(uuid);
        const rootAccount = wallet.decryptAccount(password);

        if (!req.utils.isAddress(address)) {
            throw httpError("Address is invalid.");
        }

        const hash = await req.sendTransaction(rootAccount, {
            to: address,
            value: toBN(req.body.value),
            gas: toBN(21000)
        });

        const transaction = await req.getTransaction(hash);

        return assign({type: "send"}, transaction);
    },
    schema: {
        address: {isString: true, notEmpty: true},
        password: {isString: true, notEmpty: true},
        value: {isString: true, isNumeric: true}
    }
};

const getWalletTransaction = {
    handle: async function (req) {
        await req.checkAvailability();

        const hash = req.params.hash;
        const uuid = req.params.id;

        const wallet = await req.Wallet.findOrFail(uuid);
        const transaction = await req.getTransaction(hash);

        const checksum = req.utils.toChecksumAddress;

        if (checksum(wallet.address) === transaction.from) {
            return assign({type: "send"}, transaction);
        } else if (await wallet.hasAddress(transaction.to)) {
            return assign({type: "receive"}, transaction);
        }

        throw httpError("Unrecognized transaction.");
    }
};

const getTransaction = {
    handle: async function (req) {
        await req.checkAvailability();

        const hash = req.params.hash;

        return await req.getTransaction(hash);
    }
};

const createTokenTransferWebhook = {
    handle: async function (req) {
        await req.checkAvailability();

        const uuid = req.body.wallet;
        const contract = req.body.contract;
        const webhook = req.body.url;

        const wallet = await req.Wallet.findOrFail(uuid);
        await wallet.setTokenTransferEvent(contract, {webhook});

        req.registerBlockHandler(wallet);

        return {id: uuid, status: true};
    },
    schema: {
        wallet: {isString: true, notEmpty: true},
        contract: {isString: true, notEmpty: true},
        url: {isString: true, isURL: true}
    }
};

const consolidateWalletToken = {
    handle: async function (req) {
        await req.checkAvailability();

        const uuid = req.params.id;
        const password = req.body.password;
        const contract = req.params.contract;
        const address = req.body.address;
        const toBN = req.utils.toBN;

        const wallet = await req.Wallet.findOrFail(uuid);
        const source = await wallet.findAddressOrFail(address);

        const rootAccount = wallet.decryptAccount(password);
        const fromAccount = source.decryptAccount(password);

        const token = req.useToken(contract);
        const tokenBalance = toBN(await token.balanceOf(fromAccount.address));

        if (tokenBalance.isZero() || tokenBalance.isNeg()) {
            throw httpError("Not enough amount to consolidate.", 409);
        }

        const gasPrice = toBN(await req.eth.getGasPrice());
        const gas = toBN(
            await token.estimateGas(
                fromAccount,
                rootAccount.address,
                tokenBalance
            )
        );

        const consolidateToken = async function () {
            return await token.transfer(
                fromAccount,
                rootAccount.address,
                tokenBalance,
                {gasPrice, gas}
            );
        };

        const balance = toBN(await req.eth.getBalance(fromAccount.address));
        const estimateFee = gasPrice.mul(gas);

        if (balance.gte(estimateFee)) {
            const hash = await consolidateToken();
            return await token.getTransfer(hash);
        }

        const transferFee = gasPrice.muln(21000);
        const reserved = toBN(await req.eth.getBalance(rootAccount.address));
        const required = estimateFee.sub(balance);

        if (reserved.lt(required.add(transferFee))) {
            throw httpError("Consolidation fee is insufficient.");
        }

        const skeleton = {
            value: required,
            to: fromAccount.address,
            gasPrice: gasPrice,
            gas: toBN(21000)
        };

        await req.sendTransaction(rootAccount, skeleton, {
            onReceipt: () => consolidateToken()
        });

        return {
            contract: token.address,
            from: fromAccount.address,
            to: rootAccount.address,
            value: tokenBalance.toString()
        };
    },
    schema: {
        password: {isString: true, notEmpty: true},
        address: {isString: true, notEmpty: true}
    }
};

const walletTokenSend = {
    handle: async function (req) {
        await req.checkAvailability();

        const uuid = req.params.id;
        const password = req.body.password;
        const contract = req.params.contract;
        const address = req.body.address;
        const toBN = req.utils.toBN;

        const value = toBN(req.body.value);

        const wallet = await req.Wallet.findOrFail(uuid);
        const rootAccount = wallet.decryptAccount(password);

        if (!req.utils.isAddress(address)) {
            throw httpError("Address is invalid.");
        }

        const token = req.useToken(contract);
        const tokenBalance = await token.balanceOf(rootAccount.address);

        if (toBN(tokenBalance).lt(value)) {
            throw httpError("Balance is insufficient.");
        }

        const hash = await token.transfer(rootAccount, address, value);
        const data = await token.getTransfer(hash);

        return assign({type: "send"}, data);
    },
    schema: {
        address: {isString: true, notEmpty: true},
        password: {isString: true, notEmpty: true},
        value: {isString: true, isNumeric: true}
    }
};

const getWalletTokenTransfer = {
    handle: async function (req) {
        await req.checkAvailability();

        const hash = req.params.hash;
        const contract = req.params.contract;
        const uuid = req.params.id;

        const wallet = await req.Wallet.findOrFail(uuid);

        const token = req.useToken(contract);
        const transfer = await token.getTransferReceipt(hash);

        const checksum = req.utils.toChecksumAddress;

        if (checksum(wallet.address) === transfer.from) {
            return assign({type: "send"}, transfer);
        } else if (await wallet.hasAddress(transfer.to)) {
            return assign({type: "receive"}, transfer);
        }

        throw httpError("Unrecognized transfer.");
    }
};

const getTokenTransfer = {
    handle: async function (req) {
        await req.checkAvailability();

        const contract = req.params.contract;
        const hash = req.params.hash;

        const token = req.useToken(contract);

        return await token.getTransferReceipt(hash);
    }
};

const getTokenStatus = {
    handle: async function (req) {
        await req.checkAvailability();
        try {
            const contract = req.params.contract;

            const token = req.useToken(contract);
            const total = await token.totalSupply();

            return {status: !isNaN(total)};
        } catch {
            return {status: false};
        }
    }
};

const getGasPrice = {
    handle: async function (req) {
        await req.checkAvailability();

        return {gasPrice: await req.eth.getGasPrice()};
    }
};

//--------------------------
// END REQUEST HANDLERS
//--------------------------
const execute = async (handler, req, res) => {
    try {
        const result = await handler(req);
        res.status(200).send(result);
    } catch (e) {
        let error;

        if (typeof e !== "string") {
            error = e instanceof Error ? e : new Error(JSON.stringify(e));
        } else {
            error = new Error(e);
        }

        const status = defaultTo(error.status, 500);

        if (status >= 500 && status <= 599) {
            console.error(error.stack);
        }

        const response = {message: error.message};

        res.status(status).send(response);
    }
};

/**
 * Promise handler wrapper to handle sending responses and error cases
 *
 * @param controller
 */
function requestHandler({schema, handle}) {
    return async function (req, res, next) {
        if (!isEmpty(schema)) {
            await checkSchema(schema).run(req);
        }

        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            const data = keyBy(errors.array(), "param");

            return res.status(422).send({
                errors: mapValues(data, "msg")
            });
        }

        await execute(handle, req, res, next);
    };
}

function setupRoutes(app, config) {
    app.use(bodyParser.json());

    app.get("/ping", requestHandler(ping));

    app.post("/wallets", requestHandler(createWallet));
    app.post("/wallets/:id/addresses", requestHandler(createWalletAddress));
    app.get("/wallets/:id", requestHandler(getWallet));

    app.post("/webhooks/transaction", requestHandler(createTransactionWebhook));
    app.post("/wallets/:id/consolidate", requestHandler(consolidateWallet));
    app.post("/wallets/:id/send", requestHandler(walletSend));

    app.get(
        "/wallets/:id/transactions/:hash",
        requestHandler(getWalletTransaction)
    );

    app.get("/transactions/:hash", requestHandler(getTransaction));

    app.post(
        "/webhooks/token-transfer",
        requestHandler(createTokenTransferWebhook)
    );

    app.post(
        "/wallets/:id/tokens/:contract/consolidate",
        requestHandler(consolidateWalletToken)
    );

    app.post(
        "/wallets/:id/tokens/:contract/send",
        requestHandler(walletTokenSend)
    );

    app.get(
        "/wallets/:id/tokens/:contract/transfer/:hash",
        requestHandler(getWalletTokenTransfer)
    );

    app.get(
        "/tokens/:contract/transfer/:hash",
        requestHandler(getTokenTransfer)
    );

    app.get("/tokens/:contract/status", requestHandler(getTokenStatus));

    app.get("/gas-price", requestHandler(getGasPrice));
}

export {setupRoutes};
