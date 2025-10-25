import {
    fetchCurrentBTC15MToken,
    fetchBasePrice,
    fetchOrderbook,
    fetchFinalResult,
    saveEventRecordCSV,
} from "../utils/polymarket";

(async () => {
    const token = await fetchCurrentBTC15MToken();
    if (!token) return console.log("没有获取到 token");
    console.log("token:", token);

    const base = await fetchBasePrice(token);
    console.log("基准价:", base);

    const { bids, asks } = await fetchOrderbook(token);
    console.log("bids:", bids, "asks:", asks);

    const result = await fetchFinalResult(token);
    console.log("官方最终结果:", result);

    saveEventRecordCSV(token, base ?? 0, result.finalPrice, result.winningSide);
})();
