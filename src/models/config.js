import {Schema} from "mongoose";
import {defaultCollation} from "./common.js";

export default async function (connection) {
    const schema = new Schema(
        {
            lastBlock: {type: Number}
        },
        {
            collation: defaultCollation,
            timestamps: true
        }
    );

    await connection.model("Config", schema).ensureIndexes();
    return connection.model("Config");
}
