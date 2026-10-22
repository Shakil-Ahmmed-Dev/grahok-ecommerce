import { requireAuthUser } from "@/features/auth/middlewares";
import customerActions from "@/features/customers/actions";
import { SetDefaultAddressTypeSchema } from "@/features/customers/types";
import { errorResponse, handleError, ok } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit/rate-limiter";
import { z } from "zod";

interface RouteParams {
    params: Promise<{
        addressId: string;
    }>;
}

const SetDefaultPayloadSchema = z.object({
    type: SetDefaultAddressTypeSchema,
});

export const POST = async (request: Request, { params }: RouteParams) => {
    try {
        const user = await requireAuthUser(request.headers);
        const { addressId } = await params;

        const rateLimit = await checkRateLimit(`customer:address:default:${user.id}`, 30, 60);
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
        const { type } = SetDefaultPayloadSchema.parse(body);

        const updated = await customerActions.setDefaultAddress(customer.id, addressId, type, {
            actorId: user.id,
            actorType: "customer",
            headers: request.headers,
        });
        return ok(updated);
    } catch (err) {
        return handleError(err);
    }
};
