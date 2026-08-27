import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const allowedOrigins = new Set(
    (process.env.CORS_ORIGINS ?? "")
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean)
);

const corsOptions = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
};

export function proxy(request: NextRequest) {
    const origin = request.headers.get("origin") ?? "";
    const isAllowedOrigin = Boolean(origin) && allowedOrigins.has(origin);

    // Handle preflighted requests
    if (request.method === "OPTIONS") {
        const preflightHeaders = {
            ...(isAllowedOrigin && { "Access-Control-Allow-Origin": origin }),
            ...corsOptions,
        };
        return NextResponse.json({}, { headers: preflightHeaders });
    }

    // Handle simple requests
    const response = NextResponse.next();

    if (isAllowedOrigin) {
        response.headers.set("Access-Control-Allow-Origin", origin);
    }

    Object.entries(corsOptions).forEach(([key, value]) => {
        response.headers.set(key, value);
    });

    return response;
}

export const config = {
    matcher: "/api/:path*",
};
