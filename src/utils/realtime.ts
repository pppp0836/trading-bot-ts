import WebSocket from "ws";
import axios from "axios";
import { logger } from "./logger";

const COINBASE_WS_URL = "wss://ws-feed.exchange.coinbase.com";
const COINBASE_PRODUCT = "BTC-USD";

let REALTIME_BTC_PRICE: number | null = null;
let ws: WebSocket | null = null;

/**
 * 返回当前 BTC 实时价格
 */
export function getRealtimeBTCPrice(): number | null {
    return REALTIME_BTC_PRICE;
}

/**
 * 内部处理 WS 消息
 */
function onMessage(data: WebSocket.Data) {
    try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "ticker" && msg.product_id === COINBASE_PRODUCT) {
            const price = parseFloat(msg.price);
            if (!isNaN(price)) {
                REALTIME_BTC_PRICE = price;
            }
        }
    } catch (err) {
        logger.warn("解析 Coinbase WS 消息失败:", err);
    }
}

function onError(err: Error) {
    logger.warn("Coinbase WS 错误:", err.message);
}

function onClose(code: number, reason: string) {
    logger.warn(`Coinbase WS 已关闭 code=${code} reason=${reason}`);
    // 自动重连
    setTimeout(startWS, 2000);
}

function onOpen() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const subMsg = {
        type: "subscribe",
        product_ids: [COINBASE_PRODUCT],
        channels: [{ name: "ticker", product_ids: [COINBASE_PRODUCT] }],
    };
    ws.send(JSON.stringify(subMsg), err => {
        if (err) logger.warn("Coinbase WS 订阅失败:", err);
        else logger.info("已订阅 Coinbase WS", COINBASE_PRODUCT);
    });
}

/**
 * 启动 WS 线程
 */
function startWS() {
    ws = new WebSocket(COINBASE_WS_URL);
    ws.on("open", onOpen);
    ws.on("message", onMessage);
    ws.on("error", onError);
    ws.on("close", onClose);
}

/**
 * HTTP 获取 BTC 实时价格（备用）
 */
export async function fetchBTCPriceHTTP(): Promise<number | null> {
    try {
        const resp = await axios.get("https://api.coinbase.com/v2/prices/BTC-USD/spot", { timeout: 5000 });
        return parseFloat(resp.data?.data?.amount);
    } catch (err) {
        logger.warn("HTTP 获取 BTC 价格失败:", err);
        return null;
    }
}

/**
 * 初始化实时价格获取
 */
export function initRealtimeBTC() {
    startWS();
}
