import { requireAdmin } from "@/features/auth/middlewares";
import customerActions from "@/features/customers/actions";
import { AdminUpdateCustomerSchema } from "@/features/customers/types";
import { handleError, ok } from "@/lib/http";

interface RouteParams {
    params: Promise<{
        customerId: string;
    }>;
}

export const GET = async (request: Request, { params }: RouteParams) => {
    try {
        await requireAdmin(request.headers);
        const { customerId } = await params;
        const customer = await customerActions.getCustomerAdminById(customerId);
        return ok(customer);
    } catch (err) {
        return handleError(err);
    }
};

export const PATCH = async (request: Request, { params }: RouteParams) => {
    try {
        await requireAdmin(request.headers);
        const { customerId } = await params;
        const body = await request.json();
        const validated = AdminUpdateCustomerSchema.parse(body);

        const updated = await customerActions.updateCustomerAdmin(customerId, validated);
        return ok(updated);
    } catch (err) {
        return handleError(err);
    }
};
