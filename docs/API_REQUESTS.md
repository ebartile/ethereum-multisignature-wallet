# Ethereum Wallet API

A RESTful API for wallet management, Ethereum transactions, and token operations.

## 🛠 Base URL

```
POST http://localhost:8000/
```

---

## 📡 Ping

**GET** `/ping`  
Check if the API is alive.

**Response:**

```json
{ "status": "ethereum-api is running." }
```

---

## 🔐 Create Wallet

**POST** `/wallet`

**Request Body:**

```json
{
  "password": "your_secure_password"
}
```

**Response:**

```json
{
  "id": "wallet_id",
  "address": "0x..."
}
```

---

## ➕ Create Wallet Address

**POST** `/wallet/:id/address`

**Request Body:**

```json
{
  "password": "your_secure_password"
}
```

**Response:**

```json
{
  "id": "address_id",
  "address": "0x..."
}
```

---

## 🔍 Get Wallet

**GET** `/wallet/:id`

**Response:**

```json
{
  "id": "wallet_id",
  "address": "0x..."
}
```

---

## 🔔 Create Transaction Webhook

**POST** `/webhook/transaction`

**Request Body:**

```json
{
  "wallet": "wallet_id",
  "url": "https://your-webhook-url.com"
}
```

---

## 💼 Consolidate Wallet

**POST** `/wallet/:id/consolidate`

**Request Body:**

```json
{
  "password": "your_secure_password",
  "address": "0x..."
}
```

---

## 💸 Send Ether

**POST** `/wallet/:id/send`

**Request Body:**

```json
{
  "password": "your_secure_password",
  "address": "0x...",
  "value": "1000000000000000000"  // in wei
}
```

---

## 📄 Get Wallet Transaction

**GET** `/wallet/:id/transaction/:hash`

---

## 📄 Get Transaction

**GET** `/transaction/:hash`

---

## 🧪 Create Token Transfer Webhook

**POST** `/webhook/token`

**Request Body:**

```json
{
  "wallet": "wallet_id",
  "contract": "0xTokenContract",
  "url": "https://your-webhook-url.com"
}
```

---

## ♻️ Consolidate Token

**POST** `/wallet/:id/token/:contract/consolidate`

**Request Body:**

```json
{
  "password": "your_secure_password",
  "address": "0x..."
}
```

---

## 🪙 Send Token

**POST** `/wallet/:id/token/:contract/send`

**Request Body:**

```json
{
  "password": "your_secure_password",
  "address": "0x...",
  "value": "1000"
}
```

---

## 📄 Get Wallet Token Transfer

**GET** `/wallet/:id/token/:contract/transfer/:hash`

---

## 📄 Get Token Transfer

**GET** `/token/:contract/transfer/:hash`

---

## ✅ Get Token Status

**GET** `/token/:contract/status`

---

## ⛽ Get Gas Price

**GET** `/gas-price`

**Response:**

```json
{
  "gasPrice": "1000000000"
}
```
