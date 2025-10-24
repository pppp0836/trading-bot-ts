export class RiskManager {
    lastOrderTs = 0;
    minInterval = 500; // ms

    // 判断是否达到下单间隔
    rateLimitOk(): boolean {
        return Date.now() - this.lastOrderTs > this.minInterval;
    }

    // 更新最近下单时间
    updateLastOrder() {
        this.lastOrderTs = Date.now();
    }
}