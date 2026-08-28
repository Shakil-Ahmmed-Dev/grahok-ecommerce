import { createEnv } from "@t3-oss/env-core";
import z from "zod";
import "dotenv/config";

export const env = createEnv({
    server: {
        DATABASE_URL: z.url(),
        BETTER_AUTH_SECRET: z.string(),
        BASE_URL: z.url().optional().default("http://localhost:3000")
    },
    runtimeEnv: process.env,
    emptyStringAsUndefined: true,
});
