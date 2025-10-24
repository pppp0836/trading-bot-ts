import { AccountManager } from './core/accountManager';
import { RiskManager } from './core/riskManager';
import { TradeManager } from './core/tradeManager';
import { StrategyManager } from './core/strategyManager';
import { marketMakingStrategy } from './strategies/marketMaking';
import { SIMULATE, POLLING_INTERVAL } from './config';
import { logInfo } from './utils/logger';
import { subscribeMarket } from './core/marketData';
import { recordDailyProfit } from './core/stats';

async function main() {
    const account = new AccountManager();
    const risk = new RiskManager();
    const tradeManager = new TradeManager(account, risk);

    const strategyManager = new StrategyManager(tradeManager);
    strategyManager.addStrategy(marketMakingStrategy);

    logInfo(`Trading bot started (simulate=${SIMULATE})`);

    if (SIMULATE) {
        while (true) {
            const midPrice = 100000 + Math.random() * 10000;
            const bid = midPrice - 5;
            const ask = midPrice + 5;

            await strategyManager.execute(midPrice, bid, ask);
            await tradeManager.update();

            recordDailyProfit(Date.now(), account.markToMarket(midPrice));
            await new Promise(r => setTimeout(r, POLLING_INTERVAL));
        }
    } else {
        subscribeMarket(async (mid, bid, ask) => {
            await strategyManager.execute(mid, bid, ask);
            await tradeManager.update();
            recordDailyProfit(Date.now(), account.markToMarket(mid));
        });
    }
}

main();
