// src/utils/realtime.ts
import WebSocket from "ws";
import axios from "axios";
import { logger } from "./logger";
import { COINBASE_WS_URL, COINBASE_PRODUCT } from "../config";

let REALTIME_BTC_PRICE: number | null = null;
let ws: WebSocket | null = null;
let wsStarted = false;

export function getRealtimeBTCPrice(): number | null {
    return REALTIME_BTC_PRICE;
}

function onMessage(data: WebSocket.Data) {
    try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "ticker" && msg.product_id === COINBASE_PRODUCT) {
            const p = parseFloat(msg.price);
            if (!Number.isNaN(p)) REALTIME_BTC_PRICE = p;
        }
    } catch (err) {
        logger.warn("解析 Coinbase WS 消息失败:", err);
    }
}

function onOpen() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const sub = {
        type: "subscribe",
        product_ids: [COINBASE_PRODUCT],
        channels: [{ name: "ticker", product_ids: [COINBASE_PRODUCT] }]
    };
    ws.send(JSON.stringify(sub), (err) => {
        if (err) logger.warn("Coinbase WS 订阅失败:", err);
        else logger.info(`已订阅 Coinbase WS ${COINBASE_PRODUCT}`);
    });
}

function onError(err: any) {
    logger.warn("Coinbase WS 错误:", err);
}

function onClose(code: number, reason: string) {
    logger.warn(`Coinbase WS 已关闭 code=${code} reason=${reason}`);
    // auto reconnect
    setTimeout(startRealtimeWS, 2000);
}

export function startRealtimeWS() {
    if (wsStarted) return;
    wsStarted = true;
    try {
        ws = new WebSocket(COINBASE_WS_URL);
        ws.on("open", onOpen);
        ws.on("message", onMessage);
        ws.on("error", onError);
        ws.on("close", onClose);
        logger.info("Coinbase WS thread started");
    } catch (err) {
        logger.warn("startRealtimeWS failed:", err);
        wsStarted = false;
        setTimeout(startRealtimeWS, 2000);
    }
}

export async function fetchBTCPriceHTTP(): Promise<number | null> {
    try {
        const r = await axios.get("https://api.coinbase.com/v2/prices/BTC-USD/spot", { timeout: 5000 });
        return parseFloat(r.data?.data?.amount);
    } catch (err) {
        logger.warn("HTTP 获取 BTC 失败:", err);
        return null;
    }
}
