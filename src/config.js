import {isNaN, isNil, isUndefined} from "lodash-es";
import 'dotenv/config'; // This auto-loads the .env file

function readEnv(name) {
    if (!isUndefined(process.env[name])) {
        return process.env[name];
    }
}

const getEnvConfig = () => ({
    bind: readEnv("ETHEREUM_BIND"),
    port: Number(readEnv("ETHEREUM_PORT")),
    storagePath: readEnv("ETHEREUM_STORAGE_PATH"),
    mongodbUrl: readEnv("ETHEREUM_MONGODB_URL"),
    mongodbName: readEnv("ETHEREUM_MONGODB_NAME"),
    keyPath: readEnv("ETHEREUM_KEYPATH"),
    crtPath: readEnv("ETHEREUM_CRTPATH"),
    logFile: readEnv("ETHEREUM_LOGFILE"),
    wsProvider: readEnv("ETHEREUM_WS")
});

const defaultConfig = {
    port: 7000,
    bind: "localhost",
    storagePath: "./storage",
};

function mergeConfigs(...configs) {
    function isNilOrNaN(value) {
        return isNil(value) || isNaN(value);
    }

    function get(key) {
        return configs.reduce((entry, config) => {
            return !isNilOrNaN(config[key]) ? config[key] : entry;
        }, defaultConfig[key]);
    }

    return {
        port: get("port"),
        bind: get("bind"),
        storagePath: get("storagePath"),
        mongodbUrl: get("mongodbUrl"),
        mongodbName: get("mongodbName"),
        keyPath: get("keyPath"),
        crtPath: get("crtPath"),
        logFile: get("logFile"),
        wsProvider: get("wsProvider")
    };
}

const getConfig = () => {
    const env = getEnvConfig();
    return mergeConfigs(env);
};

export {getConfig};
