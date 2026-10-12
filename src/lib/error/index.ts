export type StatusCode =
    | 200
    | 201
    | 204
    | 301
    | 308
    | 400
    | 401
    | 403
    | 404
    | 409
    | 422
    | 500;

export class AppError extends Error {
    constructor(
        public statusCode: StatusCode,
        message: string
    ) {
        super(message);
        this.name = this.constructor.name;
    }
}

export class PermanentRedirectError extends AppError {
    constructor(
        public canonicalSlug: string,
        public redirectUrl: string,
        message = "Product slug has moved permanently"
    ) {
        super(308, message);
    }
}

export class BadRequestError extends AppError {
    constructor(message = "Bad request") {
        super(400, message);
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = "Unauthorized") {
        super(401, message);
    }
}

export class ForbiddenError extends AppError {
    constructor(message = "Forbidden") {
        super(403, message);
    }
}

export class NotFoundError extends AppError {
    constructor(message = "Not found") {
        super(404, message);
    }
}

export class ConflictError extends AppError {
    constructor(message = "Conflict") {
        super(409, message);
    }
}
