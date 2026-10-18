import { requireAuthUser } from "@/features/auth/middlewares";
import customerActions from "@/features/customers/actions";
import { UpdateCustomerAddressSchema } from "@/features/customers/types";
import { errorResponse, handleError, ok } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit/rate-limiter";

interface RouteParams {
    params: Promise<{
        addressId: string;
    }>;
}

export const PATCH = async (request: Request, { params }: RouteParams) => {
    try {
        const user = await requireAuthUser(request.headers);
        const { addressId } = await params;

        const rateLimit = await checkRateLimit(`customer:address:patch:${user.id}`, 30, 60);
        if (!rateLimit.success) {
            return errorResponse("Too many requests", 429, { retryAfter: rateLimit.retryAfter });
        }

        const customer = await customerActions.getOrCreateCustomer(user.id, user.email, user.name);
        const body = await request.json();
        const validated = UpdateCustomerAddressSchema.parse(body);

        const updated = await customerActions.updateCustomerAddress(customer.id, addressId, validated, {
            actorId: user.id,
            actorType: "customer",
            headers: request.headers,
        });
        return ok(updated);
    } catch (err) {
        return handleError(err);
    }
};

export const DELETE = async (request: Request, { params }: RouteParams) => {
    try {
        const user = await requireAuthUser(request.headers);
        const { addressId } = await params;

        const rateLimit = await checkRateLimit(`customer:address:delete:${user.id}`, 20, 60);
        if (!rateLimit.success) {
            return errorResponse("Too many requests", 429, { retryAfter: rateLimit.retryAfter });
        }

        const customer = await customerActions.getOrCreateCustomer(user.id, user.email, user.name);
        const result = await customerActions.deleteCustomerAddress(customer.id, addressId, {
            actorId: user.id,
            actorType: "customer",
            headers: request.headers,
        });
        return ok(result);
    } catch (err) {
        return handleError(err);
    }
};
