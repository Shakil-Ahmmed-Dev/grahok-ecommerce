import { requireAdmin } from "@/features/auth/middlewares";
import checkoutActions from "@/features/checkout/actions";
import { handleError, ok } from "@/lib/http";

interface RouteParams {
    params: Promise<{
        orderId: string;
    }>;
}

export const GET = async (request: Request, { params }: RouteParams) => {
    try {
        await requireAdmin(request.headers);
        const { orderId } = await params;
        const order = await checkoutActions.getOrderAdminById(orderId);
        return ok(order);
    } catch (err) {
        return handleError(err);
    }
};
