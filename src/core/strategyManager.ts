import { TradeManager } from "./tradeManager";
import { OrderSignal } from "./tradeManager";

export interface Strategy {
    name: string;
    weight: number;
    generateSignals: (midPrice: number, bid: number, ask: number) => OrderSignal[];
}

export class StrategyManager {
    private strategies: Strategy[] = [];

    constructor(private tradeManager: TradeManager) {}

    addStrategy(strategy: Strategy) {
        this.strategies.push(strategy);
    }

    async execute(midPrice: number, bid: number, ask: number) {
        for (const strat of this.strategies) {
            const signals = strat.generateSignals(midPrice, bid, ask);
            for (const signal of signals) {
                signal.size = signal.size * strat.weight;
                await this.tradeManager.placeOrder(signal);
            }
        }
    }
}
