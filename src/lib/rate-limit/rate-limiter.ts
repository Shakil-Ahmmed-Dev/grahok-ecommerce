import { env } from "@/lib/t3env";
import { logger } from "@/lib/pino/logger";

export interface RateLimitResult {
    success: boolean;
    limit: number;
    remaining: number;
    reset: number; // Unix timestamp in seconds
    retryAfter: number; // Seconds until quota resets
}

interface MemoryStoreEntry {
    timestamps: number[];
}

const memoryStore = new Map<string, MemoryStoreEntry>();
const MAX_ENTRIES = 5000;

const pruneExpiredMemoryEntries = (now: number, maxAgeMs: number) => {
    if (memoryStore.size < MAX_ENTRIES) {
        return;
    }

    const threshold = now - maxAgeMs;
    for (const [key, entry] of memoryStore.entries()) {
        const filtered = entry.timestamps.filter((ts) => ts > threshold);
        if (filtered.length === 0) {
            memoryStore.delete(key);
        } else {
            entry.timestamps = filtered;
        }
    }
};

const checkMemoryRateLimit = (
    key: string,
    limit: number,
    windowSeconds: number
): RateLimitResult => {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const windowStart = now - windowMs;

    pruneExpiredMemoryEntries(now, windowMs);

    let entry = memoryStore.get(key);
    if (!entry) {
        entry = { timestamps: [] };
        memoryStore.set(key, entry);
    }

    // Retain only timestamps within the sliding window
    entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

    if (entry.timestamps.length >= limit) {
        const oldestTimestamp = entry.timestamps[0] ?? now;
        const resetMs = oldestTimestamp + windowMs;
        const retryAfter = Math.max(1, Math.ceil((resetMs - now) / 1000));
        const reset = Math.ceil(resetMs / 1000);

        return {
            success: false,
            limit,
            remaining: 0,
            reset,
            retryAfter,
        };
    }

    entry.timestamps.push(now);

    const oldestTimestamp = entry.timestamps[0] ?? now;
    const reset = Math.ceil((oldestTimestamp + windowMs) / 1000);
    const remaining = Math.max(0, limit - entry.timestamps.length);

    return {
        success: true,
        limit,
        remaining,
        reset,
        retryAfter: 0,
    };
};

const checkUpstashRateLimit = async (
    key: string,
    limit: number,
    windowSeconds: number
): Promise<RateLimitResult | null> => {
    if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
        return null;
    }

    try {
        const redisKey = `ratelimit:${key}`;
        // Multi-exec pipeline: INCR then EXPIRE with NX
        const url = `${env.UPSTASH_REDIS_REST_URL}/pipeline`;
        const response = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify([
                ["INCR", redisKey],
                ["TTL", redisKey],
            ]),
            signal: AbortSignal.timeout(1500),
        });

        if (!response.ok) {
            throw new Error(`Upstash returned HTTP ${response.status}`);
        }

        const data = await response.json() as [
            { result?: number; error?: string },
            { result?: number; error?: string }
        ];

        const count = data[0]?.result ?? 1;
        let ttl = data[1]?.result ?? windowSeconds;

        if (ttl === -1 || ttl === -2) {
            ttl = windowSeconds;
            // Set expire
            await fetch(`${env.UPSTASH_REDIS_REST_URL}/expire/${redisKey}/${windowSeconds}`, {
                headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}` },
            }).catch(() => {});
        }

        const now = Math.floor(Date.now() / 1000);
        const reset = now + Math.max(1, ttl);
        const remaining = Math.max(0, limit - count);
        const success = count <= limit;
        const retryAfter = success ? 0 : Math.max(1, ttl);

        return {
            success,
            limit,
            remaining,
            reset,
            retryAfter,
        };
    } catch (err) {
        logger.warn({
            message: "Upstash rate limiter failed; falling back to in-memory limiter",
            error: err,
        });
        return null;
    }
};

export const checkRateLimit = async (
    key: string,
    limit: number,
    windowSeconds: number
): Promise<RateLimitResult> => {
    const upstashResult = await checkUpstashRateLimit(key, limit, windowSeconds);
    if (upstashResult !== null) {
        return upstashResult;
    }

    return checkMemoryRateLimit(key, limit, windowSeconds);
};
