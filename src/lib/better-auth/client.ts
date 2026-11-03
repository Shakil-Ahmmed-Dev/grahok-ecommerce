import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";
import { env } from "../t3env";

export const authClient = createAuthClient({
  baseURL: env.NEXT_PUBLIC_BASE_URL,
  basePath: "/api/v1/auth",
  plugins: [adminClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
