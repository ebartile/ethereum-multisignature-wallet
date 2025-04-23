# Multi-Signature Ethereum Wallet API

A secure and developer-friendly **multi-signature Ethereum wallet** system supporting:

- **Ethereum Mainnet**
- **Ethereum Holesky Testnet**
- **Ethereum Sepolia Testnet**

## 🔐 What is a Multi-Signature Wallet?

A **multi-signature (multi-sig)** wallet requires **multiple private keys to authorize a transaction**. Unlike traditional wallets that require only one signature (from one private key), multi-sig wallets increase security by allowing multiple parties to verify and approve transactions.

This is ideal for:
- Shared ownership accounts
- Organizational treasury management
- High-security personal funds

📖 Learn more about multi-signature wallets here: [https://ethereum.org/en/developers/docs/smart-contracts/wallets/#multisig-wallets](https://ethereum.org/en/developers/docs/smart-contracts/wallets/#multisig-wallets)

---

## 🛡️ Security & Architecture

This project is designed for server-side use by web developers managing Ethereum wallets. It simplifies integration while maintaining a high level of security.

**Key Storage Strategy:**
- **MongoDB**: Stores one part of the wallet key data.
- **MySQL or File System**: Stores the remaining key part.
- Keys are never fully stored in one place, ensuring distributed trust and minimizing risk in case of breach.

---

## ⚙️ Deployment Steps

1. Clone the repository.

2. Obtain etheruem network node via [Chainstack Ethereum Node ➝](./CHAINSTACK_DEPLOY.md) or service provider of your chosing

3. Set up your environment variables by editing the `.env` file:

    ```env
    #--------------------------------------------------------------------------
    #  Ethereum Config
    #  (refer to our doc)
    #--------------------------------------------------------------------------
    DB_DATABASE=ethereum
    DB_USERNAME=root
    DB_PASSWORD=password
    ETHEREUM_WS=wss://ethereum-sepolia.core.chainstack.com/26ed4f10064419ad2e9e41c76464a68f
    ETHEREUM_MONGODB_URL='mongodb://root:password@localhost:27017/'
    ETHEREUM_MONGODB_NAME='ethereum-api'
    ETHEREUM_STORAGE_PATH='./storage'
    ETHEREUM_LOGFILE='logs/ethereum.log'
    ETHEREUM_KEYPATH=
    ETHEREUM_CRTPATH=
    ETHEREUM_ENV=test
    ETHEREUM_BIND=localhost
    ETHEREUM_PORT=8000
    ```

3. Build and run the project using Docker: (You will need to install docker if you have not done so)

    ```bash
    ./server initialize
    ./server up
    ```

    or 

    ```bash
    npm install
    npm run dev
    ```

4. The API should now be live at `http://localhost:8000`


5. ⚠️ **Important:** Using MongoDB from a Docker container is **not recommended** for production use.  
   Visit the official [MongoDB Deployment Documentation](https://www.mongodb.com/docs/manual/administration/install-community/) for secure and scalable deployment options.

## 📡 API Documentation

For details on how to interact with this wallet through the API, check out the full request guide here:  
➡️ [API Request Reference](./docs/API_REQUESTS.md)

---

---

## 🧰 Tech Stack

- **Node.js**
- **Web3.js**
- **MongoDB**
- **Docker**
- **REST API (Web API only)**

---

## 🙌 Contributions & Donations

If you'd like to support this project or contribute:

📧 Email: **ebartile@gmail.com**  
Hire Me: 🙌 

💰 Ethereum Address: **0xc62065388fa180ac44769b5252c8ee366be5569d**

---

