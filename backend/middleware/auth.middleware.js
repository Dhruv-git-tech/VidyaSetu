const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - verify JWT and attach user to req
const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');

            // Attach user to request (minus password)
            req.user = { userId: decoded.id, role: decoded.role, schoolId: decoded.schoolId };
            return next();
        } catch (error) {
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
};

module.exports = { protect };
