import { TradeManager } from "./tradeManager";
import { logger } from "../utils/logger";

export class StrategyManager {
    private tradeManager: TradeManager;
    private strategies: ((midPrice: number) => Promise<void>)[] = [];

    constructor(tradeManager: TradeManager) {
        this.tradeManager = tradeManager;
    }

    public addStrategy(fn: (midPrice: number) => Promise<void>) {
        this.strategies.push(fn);
    }

    public async execute(midPrice: number, refreshEventFn: () => Promise<boolean>) {
        // 事件轮换 & Claim
        await this.tradeManager.rotateEvent(refreshEventFn);

        // 策略执行
        for (const fn of this.strategies) {
            try {
                await fn(midPrice);
            } catch (err: any) {
                logger.warn(`策略执行失败: ${err.message}`);
            }
        }
    }

    public async marketMakingStrategy(midPrice: number) {
        if (!this.tradeManager.currentToken || !this.tradeManager.basePrice) return;

        const price = midPrice;
        const diff = price - this.tradeManager.basePrice;
        const absDiff = Math.abs(diff);

        const thresholds: { [key: number]: number } = {300:500,180:300,120:150,60:120,30:100,10:70,5:50,3:40,1:20};
        const secondsLeft = 60; // 可以改为事件剩余秒数
        const bucket = Object.keys(thresholds).map(Number).reduce((prev, curr) =>
                Math.abs(curr - secondsLeft) < Math.abs(prev - secondsLeft) ? curr : prev
            , 120);
        let threshold = thresholds[bucket] ?? 100;

        if (absDiff >= 500) threshold = Math.min(threshold, 200);

        const side = diff > 0 ? "UP" : "DOWN";
        this.tradeManager.side = side;

        const stakeUsd = Math.max(1, this.tradeManager.balanceUsd * 0.1);
        if (absDiff >= threshold) {
            await this.tradeManager.placeMarketOrderSim(side, stakeUsd);
        }
    }
}
