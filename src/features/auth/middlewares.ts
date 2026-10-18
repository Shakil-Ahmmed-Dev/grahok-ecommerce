import authActions from "./actions";
import { ForbiddenError, UnauthorizedError } from "@/lib/error";

export const requireAuthentication = async (headers: Headers) => {
    const isAuthenticated = await authActions.checkIsAuthenticated(headers);
    if (!isAuthenticated) {
        throw new UnauthorizedError();
    }
};

export const requireAuthUser = async (headers: Headers) => {
    const user = await authActions.getCurrentUser(headers);
    if (!user) {
        throw new UnauthorizedError();
    }
    return user;
};

export const requireAdmin = async (headers: Headers) => {
    const user = await authActions.getCurrentUser(headers);
    if (!user) {
        throw new UnauthorizedError();
    }
    if (user.role !== "admin") {
        throw new ForbiddenError();
    }
    return user;
};
