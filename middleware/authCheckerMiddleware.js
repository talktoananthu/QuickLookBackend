const jwt = require('jsonwebtoken');

const authMiddlewareForEmployer = (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log('Auth Header:', authHeader);
  console.log('token',)
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('No token provided');
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  console.log('Extracted token:', token);

  try {
    console.log('JWT_SECRET used to verify:', `"${process.env.JWT_SECRET}"`);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded payload:', decoded);

    //  if the user role in token is 'employer'
    if (decoded.role !== 'Employer') {
      console.log('error in decoded')
      return res.status(403).json({ message: 'Access denied: Employer role required' });
    }

    req.user = decoded; // attach decoded user info to request object
   req.empId = decoded.userId;
    next();
  } catch (err) {
    console.error('JWT verify error:', err);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};
const authMiddlewareForJobSeeker = (req, res, next) => {

  const authHeader = req.headers.authorization;
  console.log('Auth Header:', authHeader);
  console.log('token')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('No token provided');
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  console.log('Extracted token:', token);

  try {
    console.log('JWT_SECRET used to verify:', `"${process.env.JWT_SECRET}"`);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded payload:', decoded);

    //  if the user role in token is 'JobSeeker'
    if (decoded.role !== 'JobSeeker') {
      console.log('error in decoded')
      return res.status(403).json({ message: 'Access denied: JobSeeker role required' });
    }

    req.user = decoded; // attach decoded user info to request object
   req.JobSeekerId = decoded.userId;
    next();
  } catch (err) {
    console.error('JWT verify error:', err);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};
//adding authMiddlewareForJobSeeker here
module.exports = {
  authMiddlewareForEmployer,
  authMiddlewareForJobSeeker
};
