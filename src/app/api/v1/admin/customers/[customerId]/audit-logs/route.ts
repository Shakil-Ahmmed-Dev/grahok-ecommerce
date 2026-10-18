import { requireAdmin } from "@/features/auth/middlewares";
import customerActions from "@/features/customers/actions";
import { CustomerAuditLogListQuerySchema } from "@/features/customers/types";
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

        const url = new URL(request.url);
        const queryParams = Object.fromEntries(url.searchParams.entries());
        const validatedQuery = CustomerAuditLogListQuerySchema.parse(queryParams);

        const logs = await customerActions.getCustomerAuditLogs(customerId, validatedQuery);
        return ok(logs);
    } catch (err) {
        return handleError(err);
    }
};
