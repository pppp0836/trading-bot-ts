import * as fs from 'fs';
import * as path from 'path';
import * as csvWriter from 'csv-writer';

/** 延迟函数 */
export async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/** 确保目录存在 */
function ensureDirExist(filePath: string) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

/** 写入 CSV 文件，如果文件或目录不存在会自动创建 */
export function recordCSV(fileName: string, row: any, header: string[]) {
    const filePath = path.join(__dirname, '../data', fileName);

    // ✅ 自动创建目录
    ensureDirExist(filePath);

    const exists = fs.existsSync(filePath);

    const writer = csvWriter.createObjectCsvWriter({
        path: filePath,
        header: header.map(h => ({ id: h, title: h })),
        append: exists
    });

    writer.writeRecords([row]).catch(console.error);
}
