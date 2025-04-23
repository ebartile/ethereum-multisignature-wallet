import {Schema} from "mongoose";
import {cloneDeep} from "lodash-es";

/**
 * Encrypted account sub-document schema for Wallet and Address model
 */
const accountSchema = new Schema(
    {
        version: {type: Number, required: true},
        id: {type: String, required: true},
        address: {type: String, required: true},
        crypto: {type: Object, required: true}
    },
    {_id: false, strict: false}
);

/**
 * Default DB collation
 */
const defaultCollation = {
    locale: "en",
    numericOrdering: true
};

/**
 * Decrypt account from store
 *
 * @param web3
 * @param encrypted
 * @param password
 */
const decryptAccount = function (web3, encrypted, password) {
    return cloneDeep(web3.eth.accounts).decrypt(encrypted.toObject(), password);
};

/**
 * Generate account
 *
 * @param web3
 */
const createAccount = function (web3) {
    return cloneDeep(web3.eth.accounts).create();
};

export {accountSchema, defaultCollation, decryptAccount, createAccount};
