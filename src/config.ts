// 模拟/实盘模式
export const SIMULATE = true;
export const SYMBOL = "BTCUSD";
export const POLLING_INTERVAL = 1000;

// 策略开关
export const ENABLE_MARKET_MAKING = true;
export const ENABLE_MOMENTUM = true;

// CLOB API 配置
export const CLOB_API_URL = "https://rpc.ankr.com/eth";
export const WALLET_PRIVATE_KEY = process.env.PRIVATE_KEY || "";

// WebSocket 行情订阅
export const WS_MARKET_URL = "wss://api.polymarket.com/v1/clob/market-channel";

// 订单管理参数
export const ORDER_LIFETIME = 30_000;
export const ORDER_RETRY_COUNT = 3;

// 其他参数
export const STRATEGY_EXEC_INTERVAL = 500;
