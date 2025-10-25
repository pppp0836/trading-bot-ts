// src/utils/file.ts
import fs from "fs";
import path from "path";
import { createObjectCsvWriter } from "csv-writer";
import { DATA_DIR } from "../config";

function ensureDir(dir: string) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function recordCSV(fileName: string, row: Record<string, any>, header: string[]) {
    ensureDir(DATA_DIR);
    const filePath = path.join(DATA_DIR, fileName);

    const exists = fs.existsSync(filePath);

    const writer = createObjectCsvWriter({
        path: filePath,
        header: header.map(h => ({ id: h, title: h })),
        append: exists
    });

    writer.writeRecords([row]).catch(err => {
        console.error("write CSV error:", err);
    });
}
