import { db } from "@/lib/drizzle";
import {
    customerAuditLogsTable,
    type TCustomerAuditAction,
    type TCustomerAuditActorType,
} from "@/lib/drizzle/schemas/public";
import { logger } from "@/lib/pino/logger";

const SENSITIVE_KEY_REGEX = /password|token|secret|authorization|key|cookie|credit.?card|cvv/i;

/**
 * Recursively sanitize audit payload changes, masking any passwords or tokens.
 */
export function sanitizeAuditChanges(changes: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(changes)) {
        if (SENSITIVE_KEY_REGEX.test(key)) {
            sanitized[key] = "[REDACTED]";
        } else if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
            sanitized[key] = sanitizeAuditChanges(value as Record<string, unknown>);
        } else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}

/**
 * Extract client IP address and User Agent string from HTTP Headers.
 */
export function extractClientNetworkMeta(headers?: Headers): {
    ipAddress: string | null;
    userAgent: string | null;
} {
    if (!headers) {
        return { ipAddress: null, userAgent: null };
    }

    const forwarded = headers.get("x-forwarded-for");
    const ipAddress = forwarded
        ? forwarded.split(",")[0]?.trim() || null
        : headers.get("x-real-ip") || null;

    const userAgent = headers.get("user-agent") || null;

    return { ipAddress, userAgent };
}

export interface RecordCustomerAuditLogParams {
    customerId?: string | null;
    actorId?: string | null;
    actorType?: TCustomerAuditActorType;
    action: TCustomerAuditAction | string;
    changes?: Record<string, unknown>;
    headers?: Headers;
    ipAddress?: string | null;
    userAgent?: string | null;
}

/**
 * Safely record a customer security audit log entry.
 * Non-blocking: Contained try-catch with Pino logger to prevent disrupting user workflows.
 */
export async function recordCustomerAuditLog(
    params: RecordCustomerAuditLogParams
): Promise<void> {
    try {
        const { ipAddress: headerIp, userAgent: headerUserAgent } = extractClientNetworkMeta(params.headers);
        const resolvedIp = params.ipAddress ?? headerIp;
        const resolvedUserAgent = params.userAgent ?? headerUserAgent;
        const sanitizedChanges = sanitizeAuditChanges(params.changes ?? {});

        await db.insert(customerAuditLogsTable).values({
            customerId: params.customerId ?? null,
            actorId: params.actorId ?? null,
            actorType: params.actorType ?? "customer",
            action: params.action,
            changes: sanitizedChanges,
            ipAddress: resolvedIp,
            userAgent: resolvedUserAgent,
        });
    } catch (error) {
        // Non-blocking: log the error with Pino but never throw to disrupt core workflows
        logger.error({ error, auditEvent: { ...params, headers: undefined } }, "Failed to record customer audit log");
    }
}
