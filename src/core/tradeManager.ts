// src/core/tradeManager.ts
import { ClobClient, Chain, OrderType } from "@polymarket/clob-client";
import { Wallet, providers } from "ethers";
import { AccountManager } from "./accountManager";
import { RiskManager } from "./riskManager";
import { logInfo, logError } from "../utils/logger";
import { CLOB_API_URL, SYMBOL, SIMULATE, WALLET_PRIVATE_KEY } from "../config";

/** 统一下单信号类型 */
export type OrderSignal = {
    side: "buy" | "sell";
    price: number;
    size: number;
    symbol?: string;
};

export class TradeManager {
    private client: ClobClient | null = null;

    constructor(private account: AccountManager, private risk: RiskManager) {
        if (!SIMULATE) {
            if (!WALLET_PRIVATE_KEY) throw new Error("WALLET_PRIVATE_KEY not set");

            const provider = new providers.JsonRpcProvider("https://rpc.ankr.com/polygon");
            const wallet = new Wallet(WALLET_PRIVATE_KEY, provider);

            const host = CLOB_API_URL;
            const chainId = Chain.POLYGON; // Polygon 主网
            this.client = new ClobClient(host, chainId, wallet);

            logInfo(`✅ ClobClient initialized: ${host}`);
        } else {
            logInfo("🧪 Simulation mode enabled - skipping ClobClient init");
        }
    }

    /** update 方法，供 main.ts 调用 */
    async update(): Promise<void> {
        if (!this.client) {
            logInfo("Simulation mode: skipping update()");
            return;
        }

        try {
            const midPrice = await this.client.getMidpoint(SYMBOL);
            logInfo(`[update] MidPrice for ${SYMBOL}: ${midPrice}`);

            // TODO: 调用策略生成信号并下单
            // const signals: OrderSignal[] = strategyManager.generateSignals();
            // for (const s of signals) await this.placeOrder(s);

            this.risk.updateLastOrder?.();
        } catch (err) {
            logError(`[update] failed: ${(err as Error).message}`);
        }
    }

    /** 下单方法 */
    async placeOrder(order: OrderSignal) {
        if (!this.client) {
            logInfo("Simulation mode: skipping placeOrder()");
            return;
        }

        try {
            const userOrder = {
                tokenID: order.symbol || SYMBOL,
                price: order.price.toString(),
                size: order.size.toString(),
                side: order.side.toUpperCase(),
            };

            const signedOrder = await this.client.createOrder(userOrder as any);
            const result = await this.client.postOrder(signedOrder, OrderType.GTC);

            logInfo(`✅ Order placed: ${JSON.stringify(result)}`);

            this.risk.updateLastOrder?.();
        } catch (err) {
            logError(`❌ placeOrder failed: ${(err as Error).message}`);
        }
    }

    /** 撤单方法 */
    async cancelOrder(orderId: string) {
        if (!this.client) {
            logInfo("Simulation mode: skipping cancelOrder()");
            return;
        }

        try {
            const payload = { orderID: orderId };
            await this.client.cancelOrder(payload as any);
            logInfo(`🟡 Order canceled: ${orderId}`);
        } catch (err) {
            logError(`❌ cancelOrder failed: ${(err as Error).message}`);
        }
    }
}
