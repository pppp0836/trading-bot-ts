import { logger, sendTelegram } from "../utils/logger";
import { recordCSV } from "../utils/file";
import axios from "axios";

export interface Position {
    tokenId: string;
    side: "UP" | "DOWN";
    shares: number;
    avgPrice: number;
    stakeUsd: number;
    placedAt: Date;
    status: "OPEN" | "CLOSED";
}

export class TradeManager {
    public balanceUsd = 1000;
    public positions: Position[] = [];
    public currentToken: string | null = null;
    public basePrice: number | null = null;
    public side: "UP" | "DOWN" = "UP";

    private lastClaimedSlot: Date | null = null;

    constructor() {}

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
                profit = pos.shares * 1.0 - pos.stakeUsd;
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
}
