// src/core/strategyManager.ts
import { TradeManager, OrderSignal } from "./tradeManager";

/** 对象策略类型 */
export type StrategyObject = {
    name: string;
    weight: number;
    generateSignals: (mid: number, bid: number, ask: number) => OrderSignal[];
};

/** 多策略管理器 */
export class StrategyManager {
    private strategies: StrategyObject[] = [];

    constructor(private tradeManager?: TradeManager) {}

    /** 添加策略 */
    addStrategy(strategy: StrategyObject) {
        this.strategies.push(strategy);
    }

    /** 执行所有策略并下单 */
    async execute(mid: number, bid: number, ask: number) {
        for (const strat of this.strategies) {
            try {
                const signals = strat.generateSignals(mid, bid, ask);
                for (const signal of signals) {
                    await this.tradeManager?.placeOrder(signal);
                }
            } catch (err) {
                console.error(`[StrategyManager] Strategy ${strat.name} execution failed: ${(err as Error).message}`);
            }
        }
    }
}
