// src/core/strategyManager.ts
import { TradeManager } from "./tradeManager";
import { logger } from "../utils/logger";

export class StrategyManager {
    private tradeManager: TradeManager;
    private strategies: ((mid: number, bid: number | null, ask: number | null) => Promise<void>)[] = [];

    constructor(tradeManager: TradeManager) {
        this.tradeManager = tradeManager;
    }

    addStrategy(fn: (mid: number, bid: number | null, ask: number | null) => Promise<void>) {
        this.strategies.push(fn);
    }

    async execute(mid: number, bid: number | null, ask: number | null, refreshFn: () => Promise<boolean>) {
        // rotate & claim first
        await this.tradeManager.periodic_claim_and_rotate(this.tradeManager['last_claimed_slot'] ?? null);
        // run strategies
        for (const s of this.strategies) {
            try {
                await s(mid, bid, ask);
            } catch (err: any) {
                logger.warn("策略执行失败:", err);
            }
        }
    }

    async marketMakingStrategy(mid: number, bid: number | null, ask: number | null) {
        await this.tradeManager.trading_strategy_execute();
    }
}
