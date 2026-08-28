import { ok } from "@/lib/http";

export const GET = () =>
    ok({
        status: "ok",
        service: "grahok-ecommerce-backend",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
