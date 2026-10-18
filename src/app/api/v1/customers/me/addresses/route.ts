import { requireAuthUser } from "@/features/auth/middlewares";
import customerActions from "@/features/customers/actions";
import { CreateCustomerAddressSchema } from "@/features/customers/types";
import { created, errorResponse, handleError, ok } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit/rate-limiter";

export const GET = async (request: Request) => {
    try {
        const user = await requireAuthUser(request.headers);
        const customer = await customerActions.getOrCreateCustomer(user.id, user.email, user.name);
        const addresses = await customerActions.getCustomerAddresses(customer.id);
        return ok(addresses);
    } catch (err) {
        return handleError(err);
    }
};

export const POST = async (request: Request) => {
    try {
        const user = await requireAuthUser(request.headers);

        const rateLimit = await checkRateLimit(`customer:addresses:${user.id}`, 20, 60);
        if (!rateLimit.success) {
            return errorResponse("Too many requests", 429, { retryAfter: rateLimit.retryAfter });
        }

        const customer = await customerActions.getOrCreateCustomer(user.id, user.email, user.name);
        const body = await request.json();
        const validated = CreateCustomerAddressSchema.parse(body);

        const newAddress = await customerActions.addCustomerAddress(customer.id, validated, {
            actorId: user.id,
            actorType: "customer",
            headers: request.headers,
        });
        return created(newAddress);
    } catch (err) {
        return handleError(err);
    }
};
