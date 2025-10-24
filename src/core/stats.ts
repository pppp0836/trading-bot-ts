import { recordCSV } from '../utils/helpers';

export function recordDailyProfit(timestamp: number, equity: number) {
    recordCSV('daily_profit.csv', { timestamp, equity }, ['timestamp', 'equity']);
}
