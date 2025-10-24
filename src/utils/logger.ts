export function logInfo(msg: string) {
    console.log(`[INFO] ${new Date().toISOString()} - ${msg}`);
}

export function logError(msg: string) {
    console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`);
}
