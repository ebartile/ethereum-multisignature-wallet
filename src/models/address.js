import {Schema} from "mongoose";
import {accountSchema, decryptAccount, defaultCollation} from "./common.js";
import {httpError} from "../utils.js";

export default async function (connection) {
    const web3 = connection.web3;

    const schema = new Schema(
        {
            wallet_id: {type: String, required: true},
            address: {type: String, required: true, unique: true},
            account: {type: accountSchema, required: true}
        },
        {
            methods: {
                decryptAccount(password) {
                    try {
                        return decryptAccount(web3, this.account, password);
                    } catch (error) {
                        throw httpError(error.message, 403);
                    }
                }
            },
            collation: defaultCollation,
            timestamps: true
        }
    );

    schema.index({wallet_id: 1, address: 1});

    await connection.model("Address", schema).ensureIndexes();
    return connection.model("Address");
}
