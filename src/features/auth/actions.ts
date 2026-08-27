import { auth } from "@/lib/better-auth/auth";

const getSession = async (headers: Headers) => {
    const session = await auth.api.getSession({
        headers,
    });
    return session;
};

const checkIsAuthenticated = async (headers: Headers) => {
    const session = await getSession(headers);
    return session !== null;
};

const getCurrentUser = async (headers: Headers) => {
    const session = await getSession(headers);
    if (session) {
        return session.user;
    }
    return null;
};

const checkCurrentUserIsAdmin = async (headers: Headers) => {
    const user = await getCurrentUser(headers);
    if (user) {
        return user.role === 'admin';
    }
    return false;
};

const authActions = {
    getSession,
    checkIsAuthenticated,
    getCurrentUser,
    checkCurrentUserIsAdmin,
};

export default authActions;
