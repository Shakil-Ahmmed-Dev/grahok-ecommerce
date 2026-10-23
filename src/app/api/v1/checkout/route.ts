import authActions from "@/features/auth/actions";
import checkoutActions from "@/features/checkout/actions";
import { CheckoutProcessInputSchema } from "@/features/checkout/types";
import { created, handleError } from "@/lib/http";

export const POST = async (request: Request) => {
    try {
        const body = await request.json();
        const validated = CheckoutProcessInputSchema.parse(body);

        // Check if an authenticated user session is active
        const user = await authActions.getCurrentUser(request.headers);

        const forwarded = request.headers.get("x-forwarded-for");
        const clientIp = forwarded ? forwarded.split(",")[0].trim() : request.headers.get("x-real-ip") ?? undefined;
        const userAgent = request.headers.get("user-agent") ?? undefined;

        const order = await checkoutActions.processCheckout(validated, {
            authUserId: user?.id,
            userEmail: user?.email,
            userName: user?.name,
            emailVerified: user?.emailVerified,
            clientIp,
            userAgent,
            headers: request.headers,
        });

        return created(order);
    } catch (err) {
        return handleError(err);
    }
};
