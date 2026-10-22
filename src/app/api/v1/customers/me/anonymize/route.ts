import { errorResponse } from "@/lib/http";

export const POST = async () =>
    errorResponse("Customer account anonymization is currently unavailable", 503);
