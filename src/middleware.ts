import { NextResponse, type NextRequest } from "next/server";
import { getRateLimitTier } from "@/lib/rate-limit/config";
import { checkRateLimit } from "@/lib/rate-limit/rate-limiter";

export const middleware = async (request: NextRequest) => {
    // Determine client IP safely
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded
        ? forwarded.split(",")[0].trim()
        : request.headers.get("x-real-ip") ?? "127.0.0.1";

    const pathname = request.nextUrl.pathname;
    const tier = getRateLimitTier(pathname);
    const key = `${tier.name}:${ip}`;

    const result = await checkRateLimit(key, tier.limit, tier.windowSeconds);

    if (!result.success) {
        return new NextResponse(
            JSON.stringify({
                success: false,
                error: {
                    message: "Too many requests. Please try again later.",
                    retryAfter: result.retryAfter,
                },
            }),
            {
                status: 429,
                headers: {
                    "Content-Type": "application/json",
                    "Retry-After": result.retryAfter.toString(),
                    "X-RateLimit-Limit": result.limit.toString(),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": result.reset.toString(),
                },
            }
        );
    }

    const response = NextResponse.next();
    response.headers.set("X-RateLimit-Limit", result.limit.toString());
    response.headers.set("X-RateLimit-Remaining", result.remaining.toString());
    response.headers.set("X-RateLimit-Reset", result.reset.toString());

    return response;
};

export const config = {
    matcher: ["/api/:path*"],
};
