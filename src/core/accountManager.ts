export class AccountManager {
    position = 0;
    avgPrice = 0;
    balance = 10000;

    updatePosition(side: "buy" | "sell", price: number, size: number) {
        if (side === "buy") {
            const cost = price * size;
            this.balance -= cost;
            this.avgPrice = (this.avgPrice * this.position + cost) / (this.position + size);
            this.position += size;
        } else {
            const revenue = price * size;
            this.balance += revenue;
            this.position -= size;
            if (this.position <= 0) this.avgPrice = 0;
        }
    }

    markToMarket(currentPrice: number) {
        return this.balance + this.position * currentPrice;
    }

    summary(currentPrice: number) {
        const equity = this.markToMarket(currentPrice);
        return {
            balance: this.balance,
            position: this.position,
            avgPrice: this.avgPrice,
            equity,
        };
    }
}
