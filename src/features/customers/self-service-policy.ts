import { ForbiddenError, NotFoundError } from "@/lib/error";

export type TCustomerSelfServiceCapability =
    | "profileRead"
    | "profileWrite"
    | "addresses"
    | "export";

export function canCustomerUseSelfService(
    status: unknown,
    capability: TCustomerSelfServiceCapability
): boolean {
    if (status === "active") {
        return true;
    }

    return status === "suspended" && capability === "profileRead";
}

export function assertCustomerSelfServiceAccess(
    status: unknown,
    capability: TCustomerSelfServiceCapability
): void {
    if (canCustomerUseSelfService(status, capability)) {
        return;
    }

    if (status === "suspended") {
        throw new ForbiddenError("Customer access is unavailable");
    }

    throw new NotFoundError("Customer not found");
}

export function customerProfileForSelfService<T extends { status: unknown; addresses?: unknown }>(
    customer: T
): Omit<T, "addresses"> | T {
    assertCustomerSelfServiceAccess(customer.status, "profileRead");

    if (customer.status === "suspended") {
        const profile = { ...customer };
        delete profile.addresses;
        return profile;
    }

    return customer;
}

export type TCustomerIdentityLinkDecision = "owned" | "claim" | "reject";

export function customerIdentityLinkDeniedError(): NotFoundError {
    return new NotFoundError("Customer access is unavailable. Use account recovery if needed.");
}

export function decideCustomerIdentityLink(input: {
    authUserId: string | null;
    customerStatus: unknown;
    deletedAt: Date | string | null;
    requesterAuthUserId: string;
    emailVerified: boolean;
}): TCustomerIdentityLinkDecision {
    if (input.deletedAt !== null) {
        return "reject";
    }

    if (input.authUserId === input.requesterAuthUserId) {
        return input.customerStatus === "active" || input.customerStatus === "suspended"
            ? "owned"
            : "reject";
    }

    if (
        input.authUserId !== null ||
        input.customerStatus !== "active" ||
        !input.emailVerified
    ) {
        return "reject";
    }

    return "claim";
}
