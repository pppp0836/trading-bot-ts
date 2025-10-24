import { OrderSignal } from "../core/tradeManager";

export const marketMakingStrategy = {
    name: "MarketMaking",
    weight: 1,
    generateSignals(midPrice: number, bid: number, ask: number): OrderSignal[] {
        return [
            { side: "buy", price: midPrice - 10, size: 0.001 },
            { side: "sell", price: midPrice + 10, size: 0.001 }
        ];
    }
};
