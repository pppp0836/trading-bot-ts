// src/config.ts
export const SIMULATE_MODE = true;
export const TRADE_RATIO = 0.1;
export const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "";
export const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";
export const LOG_DIR = "logs";
export const DATA_DIR = "src/data"; // relative path used by recordCSV
export const AUDIT_CSV = "trades_audit.csv"; // file will be created inside DATA_DIR
export const COINBASE_WS_URL = "wss://ws-feed.exchange.coinbase.com";
export const COINBASE_PRODUCT = "BTC-USD";
export const POLY_EVENT_LIST_URL = "https://polymarket.com/crypto?tab=15M";
export const POLY_EVENT_URL = "https://polymarket.com/event/btc-updown-15m-{}";
export const POLY_CLOB_ORDERBOOK = "https://clob.polymarket.com/api/v5/markets";
