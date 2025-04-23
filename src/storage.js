import path from "path";
import mongoose from "mongoose";
import fs from "fs";
import mkdirp from "mkdirp";
import glob from "glob";
import bootConfig from "./models/config.js";
import bootAddress from "./models/address.js";
import bootWallet from "./models/wallet.js";

mongoose.set("strictQuery", false);

/**
 * Storage Interface
 */
class Storage {
    constructor(config, web3) {
        this.config = config;
        this.web3 = web3;
    }

    exists(filename) {
        return fs.existsSync(this.path(filename));
    }

    save(filename, content) {
        const filePath = this.path(filename);
        mkdirp.sync(path.dirname(filePath));

        fs.writeFileSync(filePath, JSON.stringify(content), "utf-8");
    }

    files(pattern) {
        return glob.sync(pattern, {cwd: this.config.storagePath});
    }

    delete(filename) {
        fs.unlinkSync(this.path(filename));
    }

    deleteDirectory(directory, recursive = false) {
        fs.rmdirSync(this.path(directory), {recursive});
    }

    load(filename) {
        return JSON.parse(fs.readFileSync(this.path(filename), "utf8"));
    }

    path(subPath) {
        return path.join(this.config.storagePath, subPath);
    }

    async bootModels() {
        if (typeof this.connection === "undefined") {
            this.connection = await mongoose
                .createConnection(this.config.mongodbUrl, {
                    dbName: this.config.mongodbName,
                    appName: this.config.mongodbName,
                    autoIndex: false
                })
                .asPromise();

            this.connection.web3 = this.web3;

            this.Wallet = await bootWallet(this.connection);
            this.Address = await bootAddress(this.connection);
            this.Config = await bootConfig(this.connection);
        }

        return this;
    }
}

/**
 * Create an instance of storage
 *
 * @param config
 * @param web3
 * @returns {Promise<Storage>}
 */
async function createStorage(config, web3) {
    const storage = new Storage(config, web3);
    return await storage.bootModels();
}

export {createStorage};
