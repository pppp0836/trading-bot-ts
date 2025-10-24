import * as fs from 'fs';
import * as path from 'path';
import * as csvWriter from 'csv-writer';

export async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function recordCSV(fileName: string, row: any, header: string[]) {
    const filePath = path.join(__dirname, '../data', fileName);
    const exists = fs.existsSync(filePath);

    const createCsvWriter = csvWriter.createObjectCsvWriter;
    const writer = createCsvWriter({
        path: filePath,
        header: header.map(h => ({ id: h, title: h })),
        append: exists
    });

    writer.writeRecords([row]).catch(console.error);
}
