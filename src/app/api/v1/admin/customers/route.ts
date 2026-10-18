import { requireAdmin } from "@/features/auth/middlewares";
import customerActions from "@/features/customers/actions";
import { CustomerListQuerySchema } from "@/features/customers/types";
import { handleError, ok } from "@/lib/http";

export const GET = async (request: Request) => {
    try {
        await requireAdmin(request.headers);
        const url = new URL(request.url);

        const rawParams: Record<string, string> = {};
        url.searchParams.forEach((val, key) => {
            rawParams[key] = val;
        });

        const query = CustomerListQuerySchema.parse(rawParams);
        const list = await customerActions.listCustomersAdmin(query);
        return ok(list);
    } catch (err) {
        return handleError(err);
    }
};
