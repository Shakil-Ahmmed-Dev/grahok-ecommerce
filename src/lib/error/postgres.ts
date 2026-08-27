import { NeonDbError } from "@neondatabase/serverless";
import { BadRequestError, ConflictError, type AppError } from "./index";

export const isNeonDbError = (err: unknown): err is NeonDbError => {
    if (err instanceof NeonDbError) {
        return true;
    }
    return (
        err instanceof Error &&
        (err as Error & { code?: unknown }).code !== undefined &&
        (err as Error & { name?: unknown }).name === "NeonDbError"
    );
};

const CONFLICT_CODES = new Set([
    "23505", // unique_violation
    "23503", // foreign_key_violation
    "23001", // restrict_violation
]);

const BAD_REQUEST_CODES = new Set([
    "23502", // not_null_violation
    "23514", // check_violation
    "22P02", // invalid_text_representation
    "22001", // string_data_right_truncation
    "22003", // numeric_value_out_of_range
]);

export const mapPostgresError = (err: NeonDbError): AppError | null => {
    if (err.code) {
        if (CONFLICT_CODES.has(err.code)) {
            return new ConflictError("A record with that value already exists");
        }
        if (BAD_REQUEST_CODES.has(err.code)) {
            return new BadRequestError("Invalid data provided");
        }
    }
    return null;
};