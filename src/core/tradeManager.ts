import { logger, sendTelegram } from "../utils/logger";
import { recordCSV } from "../utils/file";
import axios from "axios";
import { POLY_CLOB_ORDERBOOK } from "../config";

export interface Position {
    tokenId: string;
    side: "UP" | "DOWN";
    shares: number;
    avgPrice: number;
    stakeUsd: number;
    placedAt: Date;
    status: "OPEN" | "CLOSED";
}

// OrderSignal used by strategies
export type OrderSignal = {
    side: "buy" | "sell";
    price: number;
    size: number;
};

export class TradeManager {
    public balanceUsd = 1000;
    public positions: Position[] = [];
    public currentToken: string | null = null;
    public basePrice: number | null = null;
    public side: "UP" | "DOWN" = "UP";

    private lastClaimedSlot: Date | null = null;

    constructor(account?: any, opts?: any) {
        // accept optional constructor args for Backtester compatibility; no-op for now
        void account;
        void opts;
    }

    // expose snake_case aliases and last_claimed_slot for older code
    public get current_token(): string | null {
        return this.currentToken;
    }
    public set current_token(v: string | null) {
        this.currentToken = v;
    }

    public get base_price(): number | null {
        return this.basePrice;
    }
    public set base_price(v: number | null) {
        this.basePrice = v;
    }

    public get last_claimed_slot(): Date | null {
        return this.lastClaimedSlot;
    }
    public set last_claimed_slot(v: Date | null) {
        this.lastClaimedSlot = v;
    }

    // ---------------- 市价下单 ----------------
    public async placeMarketOrderSim(side: "UP" | "DOWN", stakeUsd: number) {
        const price = await this.getMarketPrice();
        if (!price) {
            logger.warn("无法获取市价，跳过下单");
            return;
        }
        const shares = stakeUsd / price;
        const pos: Position = {
            tokenId: this.currentToken!,
            side,
            shares,
            avgPrice: price,
            stakeUsd,
            placedAt: new Date(),
            status: "OPEN",
        };
        this.positions.push(pos);

        logger.info(`[SIM] 市价下单 token=${this.currentToken} side=${side} shares=${shares.toFixed(6)} 单价=${price.toFixed(2)} 投入=${stakeUsd.toFixed(2)}`);
        sendTelegram(`[SIM] 下单 token=${this.currentToken} side=${side} stake=${stakeUsd.toFixed(2)} price=${price.toFixed(2)} shares=${shares.toFixed(6)}`);

        recordCSV("daily_profit.csv", {
            timestamp_utc: new Date().toISOString(),
            action: "市价下单(sim)",
            token_id: this.currentToken,
            side,
            shares,
            price_per_share: price,
            stake_usd: stakeUsd,
        }, ["timestamp_utc", "action", "token_id", "side", "shares", "price_per_share", "stake_usd"]);
    }

    // ---------------- 获取 BTC 市价 ----------------
    public async getMarketPrice(): Promise<number | null> {
        try {
            const res = await axios.get("https://api.coinbase.com/v2/prices/BTC-USD/spot", { timeout: 5000 });
            return parseFloat(res.data.data.amount);
        } catch {
            logger.warn("获取实时 BTC 价格失败");
            return null;
        }
    }

    // ---------------- 结算 ----------------
    public async settleToken(tokenId: string) {
        const finalPrice = await this.getMarketPrice();
        if (!finalPrice || !this.basePrice) return;

        const winningSide = finalPrice > this.basePrice ? "UP" : finalPrice < this.basePrice ? "DOWN" : "TIE";

        for (const pos of [...this.positions]) {
            if (pos.tokenId !== tokenId) continue;

            let profit = 0;
            let note = "";
            if (winningSide === "TIE") {
                profit = 0;
                this.balanceUsd += pos.stakeUsd;
                note = "平局退本金";
            } else if (pos.side === winningSide) {
                profit = pos.shares - pos.stakeUsd;
                this.balanceUsd += pos.stakeUsd + profit;
                note = `胜利 收益=${profit.toFixed(2)}`;
            } else {
                profit = -pos.stakeUsd;
                note = "失败";
            }

            logger.info(`[SIM] 结算 token=${pos.tokenId} side=${pos.side} profit=${profit.toFixed(2)} note=${note}`);
            sendTelegram(`[SIM] 结算 token=${pos.tokenId} side=${pos.side} profit=${profit.toFixed(2)} note=${note}`);

            recordCSV("daily_profit.csv", {
                timestamp_utc: new Date().toISOString(),
                action: "结算(sim)",
                token_id: pos.tokenId,
                side: pos.side,
                shares: pos.shares,
                price_per_share: pos.avgPrice,
                stake_usd: pos.stakeUsd,
                final_price: finalPrice,
                profit_usd: profit,
                note,
            }, ["timestamp_utc","action","token_id","side","shares","price_per_share","stake_usd","final_price","profit_usd","note"]);

            this.positions = this.positions.filter(p => p !== pos);
        }
    }

    // ---------------- 事件轮换 ----------------
    public async rotateEvent(refreshEventFn: () => Promise<boolean>) {
        const now = new Date();
        const currentSlotStart = this.utcSlotStart(now);
        const prevSlot = new Date(currentSlotStart.getTime() - 15 * 60 * 1000);
        const claimTrigger = new Date(prevSlot.getTime() + 16 * 60 * 1000); // +16 分钟

        if (now >= claimTrigger && (!this.lastClaimedSlot || this.lastClaimedSlot < prevSlot)) {
            const tokenToClaim = this.currentToken;
            if (tokenToClaim) {
                await this.settleToken(tokenToClaim);
            }
            this.lastClaimedSlot = prevSlot;

            const refreshed = await refreshEventFn();
            if (!refreshed) {
                logger.warn("Claim 后刷新下一事件失败");
            }
        }
    }

    // ---------------- 时间槽辅助 ----------------
    public utcSlotStart(now?: Date): Date {
        if (!now) now = new Date();
        const slot = new Date(now);
        const minutes = Math.floor(slot.getUTCMinutes() / 15) * 15;
        slot.setUTCMinutes(minutes, 0, 0);
        return slot;
    }

    // ---------------- Missing methods expected by main.ts ----------------
    // Refresh current event (placeholder implementation). Should fetch/set
    // this.currentToken and this.basePrice in real usage.
    public async refresh_current_event(): Promise<boolean> {
        try {
            // Try to load markets from Polymarket CLOB API and pick a BTC 15m market
            try {
                const res = await axios.get(POLY_CLOB_ORDERBOOK, { timeout: 8000 });
                const data = res.data;
                if (Array.isArray(data) && data.length > 0) {
                    // Heuristic: find market with 'btc' and '15' or '15m' in name/display
                    const found = data.find((m: any) => {
                        const s = ((m.name || m.displayName || m.market || "") + "").toLowerCase();
                        return s.includes("btc") && (s.includes("15") || s.includes("15m") || s.includes("15-minute") || s.includes("updown"));
                    }) || data[0];

                    // use id or marketId if present
                    const tokenId = found?.id ?? found?.marketId ?? found?.symbol ?? JSON.stringify(found);
                    this.currentToken = String(tokenId);
                    logger.info("refresh_current_event: selected market from CLOB:", this.currentToken);
                }
            } catch (err) {
                // If CLOB fetch fails, fallback to slot id
                logger.debug("POLY_CLOB_ORDERBOOK fetch failed, fallback to slot token:", (err as any)?.message ?? err);
                if (!this.currentToken) {
                    const slot = this.utcSlotStart(new Date());
                    this.currentToken = `slot-${slot.toISOString()}`;
                }
            }

            // set base price from market price if not set
            if (!this.basePrice) {
                const p = await this.getMarketPrice();
                this.basePrice = p ?? this.basePrice ?? 0;
            }
            return true;
        } catch (err) {
            logger.warn("refresh_current_event 失败:", err);
            return false;
        }
    }

    // periodic_claim_and_rotate(last_claimed_slot) should perform claim/settle
    // and rotate events. Return the updated last_claimed_slot (Date|null).
    public async periodic_claim_and_rotate(last_claimed_slot: Date | null): Promise<Date | null> {
        // Use existing rotateEvent helper which uses this.lastClaimedSlot internally.
        await this.rotateEvent(async () => {
            return this.refresh_current_event();
        });
        return this.lastClaimedSlot;
    }

    // fetch_orderbook(tokenId, depth) -> { bids: [], asks: [] }
    public async fetch_orderbook(tokenId: string | null, depth = 5): Promise<{ bids: any[]; asks: any[] }> {
        // Use Coinbase Pro public orderbook for BTC-USD as a reliable source for bid/ask data.
        // tokenId is ignored for now (kept for compatibility with Polymarket market ids).
        try {
            const res = await axios.get('https://api.pro.coinbase.com/products/BTC-USD/book?level=2', { timeout: 5000 });
            const data = res.data;
            const bids = (data.bids || []).slice(0, depth).map((b: any) => ({ price: b[0], size: b[1] }));
            const asks = (data.asks || []).slice(0, depth).map((a: any) => ({ price: a[0], size: a[1] }));
            return { bids, asks };
        } catch (err) {
            logger.warn('fetch_orderbook failed, returning empty book:', (err as any)?.message ?? err);
            return { bids: [], asks: [] };
        }
    }

    // ---------------- Backtester compatibility helpers ----------------
    // Called by Backtester in original code — keep a no-op update()
    public async update(): Promise<void> {
        // In a live bot this might poll orders / settle partial fills; for now, no-op
        return Promise.resolve();
    }

    // Called by StrategyManager.marketMakingStrategy
    public async trading_strategy_execute(): Promise<void> {
        // placeholder: could aggregate strategy signals and place orders
        logger.debug("trading_strategy_execute called (placeholder)");
    }

    // ---------------- 兼容旧式 API ----------------
    public async periodic_claim_and_rotate_alias(last_claimed_slot: Date | null) {
        return this.periodic_claim_and_rotate(last_claimed_slot);
    }

}
