import axios, { AxiosRequestConfig } from "axios";
import fs from "fs";
import path from "path";
import { SocksProxyAgent } from "socks-proxy-agent";
import puppeteer from "puppeteer";

// -------------------- 代理配置 --------------------
type ProxyConfig = {
    type: "http" | "https" | "socks5";
    host: string;
    port: number;
    username?: string;
    password?: string;
};

let globalProxy: ProxyConfig | null = null;

// 设置全局代理
export function setGlobalProxy(proxy: ProxyConfig | null) {
    globalProxy = proxy;
}

// 内部辅助函数：生成 axios config
function getAxiosConfig(): AxiosRequestConfig {
    if (!globalProxy) return {};
    const p = globalProxy;

    if (p.type === "socks5") {
        const agent = new SocksProxyAgent(
            `socks5://${p.username ? `${p.username}:${p.password}@` : ""}${p.host}:${p.port}`
        );
        return { httpsAgent: agent, httpAgent: agent };
    } else {
        // http 或 https 代理
        return {
            proxy: {
                host: p.host,
                port: p.port,
                protocol: p.type,
                auth: (p.username && typeof p.password === "string") ? { username: p.username, password: p.password } : undefined,
            },
        };
    }
}

// -------------------- 获取 token id --------------------
const POLY_CRYPTO_15M = "https://polymarket.com/crypto?tab=15M";
const CLOB_API = "https://clob.polymarket.com";
const GAMMA_API = "https://gamma-api.polymarket.com";

export async function fetchCurrentBTC15MToken(): Promise<string | null> {
    try {
        const resp = await axios.get(POLY_CRYPTO_15M, getAxiosConfig());
        const html: string = resp.data;
        const match = html.match(/btc-updown-15m-(\d+)/);
        if (match) return match[1];
        return null;
    } catch (e) {
        console.warn("fetchCurrentBTC15MToken failed", e);
        return null;
    }
}

// -------------------- 获取基准价 --------------------
export async function fetchBasePrice(tokenId: string): Promise<number | null> {
    const url = `https://polymarket.com/event/btc-updown-15m-${tokenId}`;
    const browser = await puppeteer.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: "networkidle2" });

        // 延迟显示的 price to beat 在页面上可能需要等 JS 渲染
        await page.waitForSelector("text/price to beat", { timeout: 5000 }).catch(() => null);

        const priceStr = await page.$eval("span[class*='PriceToBeat']", el => el.textContent?.replace("$", "").replace(",", ""));
        const price = priceStr ? parseFloat(priceStr) : null;
        return price;
    } catch (e) {
        console.warn("fetchBasePrice failed", e);
        return null;
    } finally {
        await browser.close();
    }
}


// -------------------- 获取盘口 --------------------
export async function fetchOrderbook(tokenId: string, limit = 5): Promise<{ bids: number[], asks: number[] }> {
    try {
        const r = await axios.get(`${CLOB_API}/api/v5/markets/${tokenId}/orderbook?limit=${limit}`, getAxiosConfig());
        const bids = r.data.bids?.map((b: any) => parseFloat(b.price)) ?? [];
        const asks = r.data.asks?.map((a: any) => parseFloat(a.price)) ?? [];
        return { bids, asks };
    } catch (e) {
        console.warn("fetchOrderbook failed", e);
        return { bids: [], asks: [] };
    }
}

// -------------------- 获取官方最终结果 --------------------
export async function fetchFinalResult(tokenId: string): Promise<{ finished: boolean, finalPrice?: number, winningSide?: string }> {
    try {
        const resp = await axios.get(`${GAMMA_API}/events/${tokenId}`, getAxiosConfig());
        const ev = resp.data;
        const finished = ev.closed === true || !!ev.finishedTimestamp;
        if (!finished) return { finished: false };

        const markets = ev.markets ?? [];
        if (!markets.length) return { finished: true };

        const op = markets[0].outcomePrices ?? markets[0].outcome_price;
        let p0 = null, p1 = null;
        if (Array.isArray(op)) { p0 = op[0]; p1 = op[1]; }
        else if (typeof op === "object") { p0 = op["0"]; p1 = op["1"]; }

        if (p0 != null && p1 != null) {
            const winningSide = p1 > p0 ? "UP" : (p1 < p0 ? "DOWN" : "TIE");
            const finalPrice = (p0 + p1) / 2;
            return { finished: true, finalPrice, winningSide };
        }
        return { finished: true };
    } catch (e) {
        console.warn("fetchFinalResult failed", e);
        return { finished: false };
    }
}

// -------------------- 保存 CSV --------------------
export function saveEventRecordCSV(tokenId: string, basePrice: number, finalPrice?: number, winningSide?: string) {
    const filePath = path.resolve("data/events_results.csv");
    const header = "token_id,base_price,final_price,winning_side,recorded_at\n";
    const exists = fs.existsSync(filePath);
    const line = `${tokenId},${basePrice},${finalPrice ?? ""},${winningSide ?? ""},${new Date().toISOString()}\n`;
    if (!exists) fs.writeFileSync(filePath, header);
    fs.appendFileSync(filePath, line);
}
