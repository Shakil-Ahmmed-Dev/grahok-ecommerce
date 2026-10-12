import { AppError, PermanentRedirectError } from "@/lib/error";
import { isNeonDbError, mapPostgresError } from "@/lib/error/postgres";
import { logger } from "@/lib/pino/logger";
import { ZodError, treeifyError } from "zod";

export const JSONResponse = (data: unknown, status: number = 200) =>
    Response.json(data, { status });

export const errorResponse = (message: string, status: number = 500, details?: unknown) =>
    JSONResponse(
        {
            success: false,
            error: {
                message,
                ...(details !== undefined ? { details } : {}),
            },
        },
        status
    );

export const handleError = (err: unknown): Response => {
    if (err instanceof PermanentRedirectError) {
        return Response.json(
            {
                statusCode: 308,
                message: err.message,
                redirectUrl: err.redirectUrl,
                canonicalSlug: err.canonicalSlug,
            },
            {
                status: 308,
                headers: {
                    Location: err.redirectUrl,
                },
            }
        );
    }

    if (err instanceof AppError) {
        return errorResponse(err.message, err.statusCode);
    }

    if (err instanceof ZodError) {
        return errorResponse("Validation failed", 400, treeifyError(err));
    }

    if (isNeonDbError(err)) {
        const mapped = mapPostgresError(err);

        if (mapped) {
            const details =
                err.constraint || err.column
                    ? {
                        ...(err.constraint ? { constraint: err.constraint } : {}),
                        ...(err.column ? { column: err.column } : {}),
                    }
                    : undefined;
            return errorResponse(mapped.message, mapped.statusCode, details);
        }
    }

    // Unexpected errors
    logger.error({
        error: err,
    });

    return errorResponse("Internal server error", 500);
};

export const ok = (data: unknown) => JSONResponse(data, 200);
export const created = (data: unknown) => JSONResponse(data, 201);
