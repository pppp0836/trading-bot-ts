import { AccountManager } from './accountManager';
import { RiskManager } from './riskManager';
import { logInfo, logError } from '../utils/logger';
import { recordCSV, sleep } from '../utils/helpers';
import { SIMULATE, ORDER_LIFETIME, ORDER_RETRY_COUNT, SYMBOL, WALLET_PRIVATE_KEY, CLOB_API_URL } from '../config';
import { ClobClient } from '@polymarket/clob-client';
import { Chain } from '@polymarket/clob-client/dist/types/chain';

export interface OrderSignal {
    side: 'buy' | 'sell';
    price: number;
    size: number;
    symbol?: string;
}

interface PendingOrder extends OrderSignal {
    id?: string;
    retries: number;
    timestamp: number;
}

export class TradeManager {
    private client?: ClobClient;
    private pendingOrders: PendingOrder[] = [];

    constructor(private account: AccountManager, private risk: RiskManager) {
        if (!SIMULATE) {
            if (!WALLET_PRIVATE_KEY) throw new Error("WALLET_PRIVATE_KEY is not set");

            // 创建符合 Chain 类型的对象
            const chain: Chain = {
                name: 'ethereum',
                network: 'mainnet',
                rpcUrl: CLOB_API_URL
            };

            this.client = new ClobClient(WALLET_PRIVATE_KEY, chain);
        }
    }

    async placeOrder(signal: OrderSignal) {
        if (!this.risk.rateLimitOk()) return;

        const order: PendingOrder = { ...signal, retries: 0, timestamp: Date.now() };
        if (SIMULATE) {
            logInfo(`Simulate order: ${order.side} ${order.size}@${order.price}`);
            this.account.updatePosition(order.side, order.price, order.size);
            this.recordTrade(order);
        } else {
            await this.sendRealOrder(order);
        }

        this.pendingOrders.push(order);
    }

    private async sendRealOrder(order: PendingOrder) {
        if (!this.client) return logError('CLOB client not initialized');

        try {
            const placed = await this.client.placeOrder({
                symbol: order.symbol || SYMBOL,
                side: order.side,
                price: order.price,
                size: order.size,
                type: 'limit'
            });
            order.id = placed.id;
            logInfo(`Real order placed: ${order.side} ${order.size}@${order.price}, id=${placed.id}`);
        } catch (err: any) {
            logError(`Order failed: ${err.message}`);
            if (order.retries < ORDER_RETRY_COUNT) {
                order.retries++;
                logInfo(`Retrying order (${order.retries}) in 500ms`);
                await sleep(500);
                await this.sendRealOrder(order);
            }
        }
    }

    async update() {
        const now = Date.now();
        const remainingOrders: PendingOrder[] = [];

        for (const o of this.pendingOrders) {
            if (now - o.timestamp > ORDER_LIFETIME && o.retries >= ORDER_RETRY_COUNT) {
                logInfo(`Cancelling stale order: ${o.side} ${o.size}@${o.price}`);
                if (!SIMULATE && o.id && this.client) {
                    try {
                        await this.client.cancelOrder(o.id);
                        logInfo(`Order ${o.id} canceled successfully`);
                    } catch (err: any) {
                        logError(`Failed to cancel order ${o.id}: ${err.message}`);
                    }
                }
            } else {
                remainingOrders.push(o);
            }
        }
        this.pendingOrders = remainingOrders;
    }

    private recordTrade(order: PendingOrder) {
        recordCSV('trades.csv', {
            timestamp: Date.now(),
            side: order.side,
            price: order.price,
            size: order.size,
            retries: order.retries
        }, ['timestamp', 'side', 'price', 'size', 'retries']);
    }
}
