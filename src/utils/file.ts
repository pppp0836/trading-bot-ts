import * as fs from "fs";
import * as path from "path";
import { createObjectCsvWriter } from "csv-writer";

/**
 * 创建文件夹（如果不存在）
 */
function ensureDir(dir: string) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

/**
 * 将一行记录写入 CSV 文件
 * @param fileName 文件名（相对 data 文件夹）
 * @param row 一行对象
 * @param header 字段数组
 */
export function recordCSV(fileName: string, row: Record<string, any>, header: string[]) {
    const dataDir = path.join(__dirname, "../data");
    ensureDir(dataDir);

    const filePath = path.join(dataDir, fileName);
    const exists = fs.existsSync(filePath);

    const csvWriter = createObjectCsvWriter({
        path: filePath,
        header: header.map(h => ({ id: h, title: h })),
        append: exists,
    });

    csvWriter.writeRecords([row]).catch(err => {
        console.error("写 CSV 出错:", err);
    });
}
