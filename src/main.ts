// src/main.ts
import { TradeManager } from "./core/tradeManager";
import { StrategyManager } from "./core/strategyManager";
import { getRealtimeBTCPrice, startRealtimeWS, fetchBTCPriceHTTP } from "./utils/realtime";
import { logger, sendTelegram } from "./utils/logger";
import { recordCSV } from "./utils/file";
import { SIMULATE_MODE } from "./config";

async function refresh_current_event_wrapper(tradeManager: TradeManager) {
    logger.debug("[refresh_current_event_wrapper] 开始刷新当前事件...");
    try {
        const ok = await tradeManager.refresh_current_event();
        logger.info(`[refresh_current_event_wrapper] 刷新结果: ${ok}`);
        return ok;
    } catch (err: any) {
        logger.warn("[refresh_current_event_wrapper] 刷新失败:", err);
        return false;
    }
}

async function main() {
    logger.info("🚀 启动 trading-bot-ts (迁移自 Python 脚本) ...");

    const tradeManager = new TradeManager();
    const strategyManager = new StrategyManager(tradeManager);

    strategyManager.addStrategy(strategyManager.marketMakingStrategy.bind(strategyManager));

    logger.info("🧩 初始化 TradeManager / StrategyManager 完成");

    logger.info("🪙 启动 Coinbase 实时价格 WS 线程...");
    startRealtimeWS();

    logger.info("🔄 尝试首次刷新事件...");
    try {
        await tradeManager.refresh_current_event();
        logger.info("✅ 首次事件刷新完成");
    } catch (err: any) {
        logger.error("❌ 首次 refresh_current_event 失败:", err);
    }

    let last_claimed_slot: Date | null = null;
    let last_seen_token = tradeManager.current_token;

    sendTelegram(`🤖 Trading bot started (simulate=${SIMULATE_MODE})`);

    try {
        while (true) {
            logger.debug("🌀 循环开始 --------------------------------------");

            // Step 1: 结算与事件轮换
            logger.debug("⚙️ 执行 periodic_claim_and_rotate ...");
            last_claimed_slot = await tradeManager.periodic_claim_and_rotate(last_claimed_slot);
            logger.debug("✅ periodic_claim_and_rotate 完成");

            // Step 2: 检查 token 状态
            if (!tradeManager.current_token) {
                logger.warn("⚠️ current_token 为空，重新刷新事件");
                await tradeManager.refresh_current_event();
            }

            if (tradeManager.current_token !== last_seen_token) {
                logger.info(`🔁 事件轮换: ${last_seen_token} -> ${tradeManager.current_token}`);
                last_seen_token = tradeManager.current_token;
            }

            // Step 3: 获取价格
            logger.debug("📥 获取盘口数据 ...");
            let mid: number | null = null;
            let bid: number | null = null;
            let ask: number | null = null;

            if (tradeManager.current_token) {
                try {
                    const ob = await tradeManager.fetch_orderbook(tradeManager.current_token, 5);
                    bid = ob.bids.length ? Math.max(...ob.bids.map((b: any) => parseFloat(b.price))) : null;
                    ask = ob.asks.length ? Math.min(...ob.asks.map((a: any) => parseFloat(a.price))) : null;

                    if (bid !== null && ask !== null) {
                        mid = (bid + ask) / 2;
                        logger.debug(`📊 从盘口获取价格成功 bid=${bid} ask=${ask} mid=${mid}`);
                    } else {
                        logger.warn("⚠️ 盘口价格为空，尝试备用 HTTP 获取");
                        const p = getRealtimeBTCPrice() ?? await fetchBTCPriceHTTP();
                        mid = p;
                        logger.debug(`📊 HTTP 实时价格 = ${mid}`);
                    }
                } catch (err: any) {
                    logger.warn("❌ 获取 Orderbook 异常:", err);
                }
            }

            // Step 4: 执行策略
            if (mid !== null) {
                logger.debug(`🎯 执行策略 mid=${mid} bid=${bid} ask=${ask}`);
                await strategyManager.execute(mid, bid, ask, () =>
                    refresh_current_event_wrapper(tradeManager)
                );
                logger.debug("✅ 策略执行完成");
            } else {
                logger.warn("⚠️ mid 为空，跳过本轮策略执行");
            }

            // Step 5: 延时
            logger.debug("💤 等待 2 秒后进入下一轮 ...");
            await new Promise((r) => setTimeout(r, 2000));
        }
    } catch (err: any) {
        logger.error("💥 主循环异常:", err);
        sendTelegram("主循环异常: " + (err?.message ?? String(err)));
    }
}

main();
