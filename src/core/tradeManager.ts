import { ethers, Wallet } from "ethers";
import { ClobClient, Chain, OrderType } from "@polymarket/clob-client";
import { AccountManager } from "./accountManager";
import { RiskManager } from "./riskManager";
import { logInfo, logError } from "../utils/logger";
import {
    CLOB_API_URL,
    SIMULATE,
    SYMBOL,
    WALLET_PRIVATE_KEY
} from "../config";

/**
 * TradeManager
 * 负责下单、撤单、同步订单状态等操作
 */
export class TradeManager {
    private client: ClobClient | null = null;

    constructor(private account: AccountManager, private risk: RiskManager) {
        if (!SIMULATE) {
            if (!WALLET_PRIVATE_KEY) throw new Error("WALLET_PRIVATE_KEY not set");

            // ✅ Ethers v6 正确初始化方式
            const provider = new ethers.providers.JsonRpcProvider("https://rpc.ankr.com/polygon");
            const wallet = new Wallet(WALLET_PRIVATE_KEY, provider);

            // ✅ Polymarket 官方构造函数：host, chainId, signer
            const host = CLOB_API_URL;
            const chainId = Chain.POLYGON; // 或 Chain.MUMBAI

            this.client = new ClobClient(host, chainId, wallet);
            logInfo(`✅ ClobClient initialized: ${host} (Chain=${chainId})`);
        } else {
            logInfo("🧪 Simulation mode enabled - ClobClient skipped");
        }
    }

    /**
     * 下单
     */
    async placeOrder(order: {
        side: "buy" | "sell";
        price: number;
        size: number;
        symbol?: string;
    }): Promise<void> {
        if (!this.client) {
            logInfo("Simulation mode: skipping real order placement");
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

            this.risk.updateLastOrder();
        } catch (err) {
            logError(`❌ placeOrder failed: ${(err as Error).message}`);
        }
    }

    /**
     * 撤单
     */
    async cancelOrder(orderId: string): Promise<void> {
        if (!this.client) {
            logInfo("Simulation mode: skipping cancel");
            return;
        }

        try {
            const payload = { orderID: orderId };
            const res = await this.client.cancelOrder(payload as any);
            logInfo(`🟡 Order canceled: ${orderId} → ${JSON.stringify(res)}`);
        } catch (err) {
            logError(`❌ cancelOrder failed: ${(err as Error).message}`);
        }
    }

    /**
     * 获取中间价
     */
    async getMidPrice(tokenID: string): Promise<number | null> {
        if (!this.client) return null;
        try {
            const price = await this.client.getMidpoint(tokenID);
            return Number(price);
        } catch (err) {
            logError("❌ getMidPrice failed: " + (err as Error).message);
            return null;
        }
    }
}
