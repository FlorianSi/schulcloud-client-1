const userHasPermission = (user, permissions, operator = 'AND') => {
    if (!user) return false;

    if (!Array.isArray(permissions)) {
        permissions = [permissions];
    }

    const OPERATORS = ['OR', 'AND', 'XOR', 'NOT', '!'];
    operator = operator.toUpperCase();
    if (!OPERATORS.includes(operator)) {
        throw new Error(`Permission Operator mismatch: ${operator}.`);
    }

    const userPermissions = user.permissions || [];

    const userHasPermission = (permission) => userPermissions.includes(permission);
    const hasAllPermissions = permissions.every(userHasPermission);
    const hasAnyPermission = permissions.some(userHasPermission);

    if (operator === 'AND' && hasAllPermissions) {
        return true;
    }
    if (operator === 'OR' && hasAnyPermission) {
        return true;
    }
    if (operator === 'XOR' && (hasAnyPermission && !hasAllPermissions)) {
        return true;
    }
    if ((operator === '!' || operator === 'NOT') && !hasAnyPermission) {
        return true;
    }

    return false;
};

module.exports = {
    userHasPermission,
    permissionsChecker: (permission, operator) => (req, res, next) => {
        if (userHasPermission(res.locals.currentUser, permission, operator)) {
            return next();
        }

        const error = new Error('Not authorized');
        error.status = 401;
        return next(error);
    }
};
