export async function fetchWithTimeout(
    input: Parameters<typeof fetch>[0],
    timeoutMs: number
): Promise<Awaited<ReturnType<typeof fetch>>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(input, {
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timeoutId);
    }
}
