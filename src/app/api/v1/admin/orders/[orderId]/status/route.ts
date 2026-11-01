import { requireAdmin } from "@/features/auth/middlewares";
import checkoutActions from "@/features/checkout/actions";
import { AdminOrderStatusTransitionInputSchema } from "@/features/checkout/types";
import { handleError, ok } from "@/lib/http";

interface RouteParams {
    params: Promise<{
        orderId: string;
    }>;
}

export const PATCH = async (request: Request, { params }: RouteParams) => {
    try {
        const admin = await requireAdmin(request.headers);
        const { orderId } = await params;
        const body = await request.json();
        const validated = AdminOrderStatusTransitionInputSchema.parse(body);

        const forwarded = request.headers.get("x-forwarded-for");
        const clientIp = forwarded ? forwarded.split(",")[0].trim() : request.headers.get("x-real-ip") ?? undefined;
        const userAgent = request.headers.get("user-agent") ?? undefined;

        const updated = await checkoutActions.updateOrderStatusAdmin(orderId, validated, {
            adminId: admin.id,
            clientIp,
            userAgent,
            headers: request.headers,
        });

        return ok(updated);
    } catch (err) {
        return handleError(err);
    }
};
