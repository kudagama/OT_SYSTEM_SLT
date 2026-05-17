const jwt  = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided. Please log in.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Always fetch role from DB — ensures old tokens (without role in payload) still work
    const dbUser = await User.findById(decoded.id).select('name email employeeId role').lean();
    if (!dbUser) {
      return res.status(401).json({ success: false, message: 'User not found. Please log in again.' });
    }

    req.user = {
      id:         decoded.id,
      name:       dbUser.name,
      email:      dbUser.email,
      employeeId: dbUser.employeeId,
      role:       dbUser.role || 'user',
    };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token. Please log in again.' });
  }
};
