import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../drizzle";
import { env } from "../t3env";
import { admin } from "better-auth/plugins";

export const auth = betterAuth({
    baseURL: env.BASE_URL,
    secret: env.BETTER_AUTH_SECRET,
    basePath: "/api/v1/auth",
    database: drizzleAdapter(db, {
        provider: "pg",
    }),
    emailAndPassword: {
        enabled: true,
    },
    plugins: [admin()]
});
