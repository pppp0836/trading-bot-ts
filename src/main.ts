import { TradeManager } from "./core/tradeManager";
import { StrategyManager } from "./core/strategyManager";
import { getRealtimeBTCPrice } from "./utils/realtime";

async function refreshCurrentEvent(): Promise<boolean> {
    // TODO: 使用 Selenium / Polymarket API 获取最新事件 token 与 basePrice
    // 返回 true 表示刷新成功，false 表示失败
    return true;
}

async function main() {
    const tradeManager = new TradeManager();
    const strategyManager = new StrategyManager(tradeManager);

    strategyManager.addStrategy(strategyManager.marketMakingStrategy.bind(strategyManager));

    console.info("交易机器人已启动 (SIMULATION)");

    while (true) {
        const midPrice = await getRealtimeBTCPrice();
        if (!midPrice) continue;

        await strategyManager.execute(midPrice, refreshCurrentEvent);

        await new Promise(res => setTimeout(res, 2000));
    }
}

main();
