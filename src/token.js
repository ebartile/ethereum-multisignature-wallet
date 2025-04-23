import tokenABI from "./tokenAbi.js";
import {
    buildTokenTransfer,
    decodeTransferEvents,
    httpError,
    sendTransaction
} from "./utils.js";

class Token {
    constructor(web3, address) {
        this.web3 = web3;
        this.address = this.checksum(address);
        this.initialize();
    }

    initialize() {
        this.contract = new this.web3.eth.Contract(tokenABI, this.address);
    }

    checksum = (address) => {
        return this.web3.utils.toChecksumAddress(address);
    };

    async balanceOf(address) {
        return await this.contract.methods.balanceOf(address).call();
    }

    async totalSupply() {
        return await this.contract.methods.totalSupply().call();
    }

    async estimateGas(account, recipient, value) {
        const query = this.contract.methods.transfer(recipient, value);

        return await query.estimateGas({from: account.address});
    }

    async transfer(account, recipient, value, options = {}) {
        const query = this.contract.methods.transfer(recipient, value);

        if (typeof options.gas === "undefined") {
            options.gas = await query.estimateGas({from: account.address});
        }

        return await sendTransaction(this.web3, account, {
            ...options,
            data: query.encodeABI(),
            to: this.address
        });
    }

    decodeTransferEvents(logs) {
        return decodeTransferEvents(logs, this.address, this.web3);
    }

    async getTransfer(hash) {
        const transaction = await this.web3.eth.getTransaction(hash);
        if (!transaction?.hash) throw httpError("Transfer does not exists.");

        if (this.address !== this.checksum(transaction.to)) {
            throw httpError("Unknown contract transfer.");
        }

        return buildTokenTransfer(transaction, this.web3);
    }

    async getTransferReceipt(hash) {
        const response = await this.getTransfer(hash);
        const receipt = await this.web3.eth.getTransactionReceipt(hash);

        if (!receipt?.status) throw httpError("Transaction is not confirmed.");
        const transferEvents = this.decodeTransferEvents(receipt.logs);

        const transferEvent = transferEvents.find((event) => {
            return (
                this.checksum(event.from) === response.from &&
                this.checksum(event.to) === response.to
            );
        });

        if (typeof transferEvent !== "object") {
            throw httpError("Transfer event not found.");
        } else {
            response.value = transferEvent.value;
        }

        const current = await this.web3.eth.getBlockNumber();
        const block = await this.web3.eth.getBlock(response.blockNumber);
        response.confirmations = current - response.blockNumber;
        response.timestamp = block.timestamp;

        return response;
    }
}

export {Token};
