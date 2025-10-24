import { StrategyManager, Strategy } from './strategyManager';
import { AccountManager } from './accountManager';
import { TradeManager } from './tradeManager';
import { logInfo } from '../utils/logger';

export interface HistoricalData {
    timestamp: number;
    midPrice: number;
    bid: number;
    ask: number;
}

export class Backtester {
    private account: AccountManager;
    private tradeManager: TradeManager;
    private strategyManager: StrategyManager;

    constructor(strategies: Strategy[]) {
        this.account = new AccountManager();
        this.tradeManager = new TradeManager(this.account, {
            rateLimitOk: () => true
        });
        this.strategyManager = new StrategyManager(this.tradeManager);
        strategies.forEach(s => this.strategyManager.addStrategy(s));
    }

    async run(historicalData: HistoricalData[]) {
        for (const bar of historicalData) {
            await this.strategyManager.execute(bar.midPrice, bar.bid, bar.ask);
            await this.tradeManager.update();
            logInfo(`Time: ${bar.timestamp}, Equity: ${this.account.markToMarket(bar.midPrice)}`);
        }
        logInfo(`回测结束，最终资金: ${this.account.markToMarket(historicalData[historicalData.length - 1].midPrice)}`);
    }
}
