import WebSocket from 'ws';
import { COINBASE_WS_URL as WS_MARKET_URL } from '../config';
import { logger } from '../utils/logger';

export type MarketCallback = (mid: number, bid: number, ask: number) => void;

export function subscribeMarket(onData: MarketCallback) {
    const ws = new WebSocket(WS_MARKET_URL);

    ws.on('open', () => logger.info('WebSocket connected'));
    ws.on('message', (msg: string) => {
        try {
            const data = JSON.parse(msg);
            const mid = data.midPrice;
            const bid = data.bestBid;
            const ask = data.bestAsk;
            onData(mid, bid, ask);
        } catch {}
    });
    ws.on('close', () => logger.info('WebSocket closed'));
}
