import { requireAuthUser } from "@/features/auth/middlewares";
import customerActions from "@/features/customers/actions";
import { UpdateCustomerProfileSchema } from "@/features/customers/types";
import { errorResponse, handleError, ok } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit/rate-limiter";

export const GET = async (request: Request) => {
    try {
        const user = await requireAuthUser(request.headers);
        const customer = await customerActions.getOrCreateCustomer(
            user.id,
            user.email,
            user.name,
            user.emailVerified
        );
        return ok(customer);
    } catch (err) {
        return handleError(err);
    }
};

export const PATCH = async (request: Request) => {
    try {
        const user = await requireAuthUser(request.headers);

        const rateLimit = await checkRateLimit(`customer:me:${user.id}`, 30, 60);
        if (!rateLimit.success) {
            return errorResponse("Too many requests", 429, { retryAfter: rateLimit.retryAfter });
        }

        const customer = await customerActions.getOrCreateCustomer(
            user.id,
            user.email,
            user.name,
            user.emailVerified
        );
        const body = await request.json();
        const validated = UpdateCustomerProfileSchema.parse(body);

        const updated = await customerActions.updateCustomerProfile(customer.id, validated, {
            actorId: user.id,
            actorType: "customer",
            headers: request.headers,
        });
        return ok(updated);
    } catch (err) {
        return handleError(err);
    }
};
