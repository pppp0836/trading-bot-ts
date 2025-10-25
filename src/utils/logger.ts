import fs from "fs";
import path from "path";
import axios from "axios";

// ---------------- 配置 ----------------
const LOG_DIR = path.join(__dirname, "../logs");
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";
const DEBUG_MODE = process.env.DEBUG_MODE === "true"; // 控制 debug 输出

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// ---------------- 工具函数 ----------------
function getLogFilePath() {
    const now = new Date();
    const filename = now.toISOString().slice(0, 10) + ".log";
    return path.join(LOG_DIR, filename);
}

function formatMessage(level: string, msg: string) {
    const timestamp = new Date().toISOString();
    return `${timestamp} [${level}] ${msg}`;
}

type LogArg = string | Error | any;

function combineArgs(arg1: LogArg, arg2?: LogArg) {
    if (arg2 !== undefined) {
        return `${arg1} ${
            arg2 instanceof Error ? arg2.stack || arg2.message : JSON.stringify(arg2)
        }`;
    } else {
        return arg1 instanceof Error ? arg1.stack || arg1.message : JSON.stringify(arg1);
    }
}

// ---------------- Logger ----------------
export const logger = {
    info: (arg1: LogArg, arg2?: LogArg) => {
        const msg = combineArgs(arg1, arg2);
        const formatted = formatMessage("INFO", msg);
        console.log(formatted);
        fs.appendFile(getLogFilePath(), formatted + "\n", () => {});
    },

    warn: (arg1: LogArg, arg2?: LogArg) => {
        const msg = combineArgs(arg1, arg2);
        const formatted = formatMessage("WARN", msg);
        console.warn(formatted);
        fs.appendFile(getLogFilePath(), formatted + "\n", () => {});
    },

    error: (arg1: LogArg, arg2?: LogArg) => {
        const msg = combineArgs(arg1, arg2);
        const formatted = formatMessage("ERROR", msg);
        console.error(formatted);
        fs.appendFile(getLogFilePath(), formatted + "\n", () => {});
    },

    debug: (arg1: LogArg, arg2?: LogArg) => {
        const msg = combineArgs(arg1, arg2);
        const formatted = formatMessage("DEBUG", msg);
        console.log(formatted);
        fs.appendFile(getLogFilePath(), formatted + "\n", () => {});
    },
};

// ---------------- Telegram ----------------
export async function sendTelegram(msg: string) {
    if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return;
    try {
        await axios.post(
            `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
            { chat_id: TELEGRAM_CHAT_ID, text: msg },
            { timeout: 8000 }
        );
    } catch (err: any) {
        logger.warn("Telegram 发送失败:", err);
    }
}
