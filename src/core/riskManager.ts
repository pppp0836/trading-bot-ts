export class RiskManager {
    private lastOrderTs = 0;
    private minInterval = 500; // ms

    rateLimitOk(): boolean {
        const now = Date.now();
        if (now - this.lastOrderTs >= this.minInterval) {
            this.lastOrderTs = now;
            return true;
        }
        return false;
    }
}
