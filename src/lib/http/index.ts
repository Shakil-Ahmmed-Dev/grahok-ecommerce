import { AppError } from "@/lib/error";
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
    if (err instanceof AppError) {
        return errorResponse(err.message, err.statusCode);
    }

    if (err instanceof ZodError) {
        return errorResponse("Validation failed", 400, treeifyError(err));
    }

    // Unexpected errors
    logger.error({
        error: err,
    });

    return errorResponse("Internal server error", 500);
};

export const ok = (data: unknown) => JSONResponse(data, 200);
export const created = (data: unknown) => JSONResponse(data, 201);
