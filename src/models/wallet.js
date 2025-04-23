import {Schema} from "mongoose";
import {assign, isEmpty} from "lodash-es";
import {v4 as createUuid} from "uuid";
import {httpError} from "../utils.js";
import {
    accountSchema,
    createAccount,
    decryptAccount,
    defaultCollation
} from "./common.js";

export default async function (connection) {
    const web3 = connection.web3;
    const checksum = web3.utils.toChecksumAddress;

    const schema = new Schema(
        {
            _id: {type: String, default: () => createUuid()},
            address: {type: String, required: true, unique: true},
            account: {type: accountSchema, required: true},
            events: {
                tokenTransfer: [
                    {contract: String, webhook: String, enabled: Boolean}
                ],
                transaction: {webhook: String, enabled: Boolean}
            }
        },
        {
            statics: {
                async findOrFail(id) {
                    const model = await this.findById(id);
                    if (!isEmpty(model)) return model;

                    throw httpError(`Wallet [${id}] does not exist.`, 404);
                },

                async findOrCreate(id, fields) {
                    const model = await this.findById(id);
                    if (!isEmpty(model)) return model;

                    return await this.create({
                        _id: id,
                        address: checksum(fields?.address),
                        account: fields?.account
                    });
                },

                async generate(password) {
                    const account = createAccount(web3);

                    return await this.create({
                        account: account.encrypt(password),
                        address: account.address
                    });
                }
            },
            methods: {
                decryptAccount(password) {
                    try {
                        return decryptAccount(web3, this.account, password);
                    } catch (error) {
                        throw httpError(error.message, 403);
                    }
                },

                async findAddress(address) {
                    return await connection
                        .model("Address")
                        .findOne({wallet_id: this._id, address});
                },

                async findAddressOrCreate(address, fields) {
                    address = checksum(address);
                    const model = await this.findAddress(address);
                    if (!isEmpty(model)) return model;

                    return await connection.model("Address").create({
                        address: address,
                        account: fields?.account,
                        wallet_id: this._id
                    });
                },

                async findAddressOrFail(address) {
                    const model = await this.findAddress(address);
                    if (!isEmpty(model)) return model;

                    throw httpError(`Address [${address}] does not exist.`, 404); // prettier-ignore
                },

                async hasAddress(address) {
                    return await connection
                        .model("Address")
                        .exists({wallet_id: this._id, address})
                        .then((o) => !isEmpty(o));
                },

                async generateAddress(password) {
                    if (!this.decryptAccount(password).address) {
                        throw httpError(`Wallet [${this._id}] is corrupt.`);
                    }

                    const account = createAccount(web3);

                    return await connection.model("Address").create({
                        address: account.address,
                        account: account.encrypt(password),
                        wallet_id: this._id
                    });
                },

                async setTransactionEvent(fields) {
                    this.events.transaction = fields;

                    return await this.save();
                },

                async setTokenTransferEvent(contract, fields) {
                    contract = checksum(contract);
                    const changes = assign({contract}, fields);

                    const position = this.events.tokenTransfer.findIndex(
                        (document) => document.contract === contract
                    );

                    if (position >= 0) {
                        this.events.tokenTransfer.set(position, changes);
                    } else {
                        this.events.tokenTransfer.push(changes);
                    }

                    return await this.save();
                }
            },
            collation: defaultCollation,
            timestamps: true
        }
    );

    await connection.model("Wallet", schema).ensureIndexes();
    return connection.model("Wallet");
}
