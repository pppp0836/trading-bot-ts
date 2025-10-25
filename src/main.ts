// src/main.ts
import { TradeManager } from "./core/tradeManager";
import { StrategyManager } from "./core/strategyManager";
import { getRealtimeBTCPrice, startRealtimeWS, fetchBTCPriceHTTP } from "./utils/realtime";
import { logger, sendTelegram } from "./utils/logger";
import { recordCSV } from "./utils/file";
import { SIMULATE_MODE } from "./config";

async function refresh_current_event_wrapper(tradeManager: TradeManager) {
    return await tradeManager.refresh_current_event();
}

async function main() {
    logger.info("Starting trading-bot-ts (migration of python script) ...");
    const tradeManager = new TradeManager();
    const strategyManager = new StrategyManager(tradeManager);

    // register strategy
    strategyManager.addStrategy(strategyManager.marketMakingStrategy.bind(strategyManager));

    // initial refresh
    await tradeManager.refresh_current_event();

    let last_claimed_slot: Date | null = null;
    let last_seen_token = tradeManager.current_token;

    sendTelegram(`Trading bot started (simulate=${SIMULATE_MODE})`);

    try {
        while (true) {
            last_claimed_slot = await tradeManager.periodic_claim_and_rotate(last_claimed_slot);
            if (!tradeManager.current_token) {
                await tradeManager.refresh_current_event();
            }
            if (tradeManager.current_token !== last_seen_token) {
                logger.info(`事件轮换: ${last_seen_token} -> ${tradeManager.current_token}`);
                last_seen_token = tradeManager.current_token;
            }

            // get mid, bid, ask
            let mid: number | null = null;
            let bid: number | null = null;
            let ask: number | null = null;
            if (tradeManager.current_token) {
                const ob = await tradeManager.fetch_orderbook(tradeManager.current_token, 5);
                bid = ob.bids.length ? Math.max(...ob.bids.map((b: any) => parseFloat(b.price))) : null;
                ask = ob.asks.length ? Math.min(...ob.asks.map((a: any) => parseFloat(a.price))) : null;
                if (bid !== null && ask !== null) mid = (bid + ask) / 2;
                else {
                    const p = getRealtimeBTCPrice() ?? await fetchBTCPriceHTTP();
                    mid = p;
                }
            }

            if (mid !== null) {
                await strategyManager.execute(mid, bid, ask, () => refresh_current_event_wrapper(tradeManager));
            }

            await new Promise((r) => setTimeout(r, 2000));
        }
    } catch (err: any) {
        logger.error("主循环异常:", err);
        sendTelegram("主循环异常: " + (err?.message ?? String(err)));
    }
}

main();
