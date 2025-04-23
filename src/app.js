import path from "path";
import {SSL_OP_NO_TLSv1} from "constants";
import graceful from "node-graceful";
import fs from "fs";
import https from "https";
import http from "http";
import express from "express";
import morgan from "morgan";
import {checkPreconditions, isValidString} from "./utils.js";
import {startEvent} from "./events.js";
import {createWeb3, injectWeb3} from "./web3.js";
import {createStorage} from "./storage.js";
import {getConfig} from "./config.js";
import {setupRoutes} from "./routes.js";

/**
 * Set up the logging middleware provided by morgan
 *
 * @param app
 * @param config
 */
function setupLogging(app, config) {
    let middleware = morgan("combined");

    if (config.logFile) {
        const logPath = path.join(config.storagePath, config.logFile);

        middleware = morgan("combined", {
            stream: fs.createWriteStream(logPath, {flags: "a"})
        });
    }

    app.use(middleware);
}

/**
 * Create an HTTP server configured for accepting HTTPS connections
 *
 * @param app
 * @param config application configuration
 * @return {Server}
 */
async function createHttpsServer(app, config) {
    const fullPath = (subPath) => path.join(config.storagePath, subPath);

    const keyPromise = fs.promises.readFile(fullPath(config.keyPath), "utf8");
    const crtPromise = fs.promises.readFile(fullPath(config.crtPath), "utf8");
    const [key, cert] = await Promise.all([keyPromise, crtPromise]);

    return https.createServer({secureOptions: SSL_OP_NO_TLSv1, key, cert}, app);
}

/**
 * Create an HTTP server configured for accepting plain old HTTP connections
 *
 * @param app
 * @returns {Server}
 */
function createHttpServer(app) {
    return http.createServer(app);
}

/**
 * Create a startup function which will run upon server initialization
 *
 * @param config
 * @return {Function}
 */
function startup(config) {
    const baseUri = getBaseUri(config);

    return function () {
        console.log("Ethereum-API is running");
        console.log(`Base URI: ${baseUri}`);
    };
}

/**
 * Helper function to determine whether we should run the server over TLS or not
 *
 * @param config
 * @returns {boolean}
 */
function isTLS(config) {
    return isValidString(config.keyPath) && isValidString(config.crtPath);
}

/**
 * Create either an HTTP or HTTPS server
 *
 * @param config
 * @param app
 * @return {Server}
 */
async function createServer(config, app) {
    return isTLS(config)
        ? await createHttpsServer(app, config)
        : createHttpServer(app);
}

/**
 * Create the base URI where the BitGoExpress server will be available once started
 *
 * @return {string}
 */
function getBaseUri(config) {
    const protocol = isTLS(config) ? "https" : "http";
    return `${protocol}://${config.bind}:${config.port}`;
}

/**
 * Start application and its dependencies
 *
 * @param config
 * @param web3
 * @param storage
 * @returns {Promise<Express>}
 */
async function startApp(config, web3, storage) {
    const expressApp = express();

    setupLogging(expressApp, config);
    injectWeb3(expressApp, web3, storage);
    await startEvent(expressApp, web3, storage);
    setupRoutes(expressApp, config);

    return expressApp.use(function (req, res) {
        res.status(404).send("Unknown API request.");
    });
}

const config = getConfig();
checkPreconditions(config);

const web3 = await createWeb3(config);
const storage = await createStorage(config, web3);

const app = await startApp(config, web3, storage);
const server = await createServer(config, app);

const {port, bind} = config;
server.listen(port, bind, startup(config));

graceful.captureExceptions = true;
graceful.exitOnDouble = false;
graceful.captureRejections = true;

graceful.on("exit", async (signal, error) => {
    console.info(`Received: ${signal}`);
    await server.close(() => console.log("Server closed."));
    if (error) console.error(error);
});
