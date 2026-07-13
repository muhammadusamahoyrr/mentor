const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { generateToken, verifyToken } = require('../utils/jwt');
const { emitUserRegistered } = require('../events/userProducer');
const redisCache = require('../../../../shared/events/redisClient');
const { asyncHandler, AppError } = require('../../../../shared/middleware/errorHandler');

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
};

function getUserIdFromDecoded(decoded) {
  return (decoded.id || decoded.userId)?.toString?.() ?? decoded.id;
}

exports.register = asyncHandler(async (req, res, next) => {
  const { email, password, role, name, specialization } = req.body;
  if (!email || !password || !name) {
    return next(new AppError('All fields required', 400));
  }

  let user = await User.findOne({ email });
  
  if (user) {
    return next(new AppError('User already exists', 400));
  }

  const hashed = await bcrypt.hash(password, 10);
  
  user = await User.create({ email, password: hashed, role: role || 'patient', name, specialization });

  await emitUserRegistered({
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    specialization: user.specialization
  });

  const token = generateToken(user);
  
  const sessionData = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
    name: user.name,
    specialization: user.specialization,
    createdAt: new Date()
  };
  await redisCache.setSession(user._id.toString(), sessionData, 7 * 24 * 60 * 60);
  
  res.cookie('token', token, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });

  res.status(201).json({ user: { id: user.id, email: user.email, role: user.role, name: user.name, specialization: user.specialization } });
});

exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;
  
  const attemptKey = `login_attempts:${email}`;
  const attempts = await redisCache.incrementAttempts(attemptKey, 900);

  if (attempts > 5) {
    return next(new AppError('Too many login attempts. Try again later.', 429));
  }
  
  const user = await User.findOne({ email });

  if (!user) {
    return next(new AppError('Invalid credentials', 401));
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    return next(new AppError('Invalid credentials', 401));
  }

  await redisCache.resetAttempts(attemptKey);

  const token = generateToken(user);

  const sessionData = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
    name: user.name,
    specialization: user.specialization,
    loginTime: new Date()
  };
  await redisCache.setSession(user._id.toString(), sessionData, 7 * 24 * 60 * 60);

  res.cookie('token', token, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });

  const userResponse = {
    id: user._id.toString(), 
    _id: user._id.toString(), 
    email: user.email,
    name: user.name,
    role: user.role,
    specialization: user.specialization
  };

  res.json({
    message: 'Login successful',
    user: userResponse
  });
});

exports.logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.token;

  if (req.user?.id) {
    await redisCache.deleteSession(getUserIdFromDecoded(req.user));
  } else if (token) {
    try {
      const decoded = verifyToken(token);
      await redisCache.deleteSession(getUserIdFromDecoded(decoded));
    } catch {
      // Token expired — still clear the cookie below
    }
  }

  res.clearCookie('token', cookieOptions);
  res.json({ message: 'Logged out successfully' });
});

exports.getUserById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const user = await User.findById(id).select('-password');
  
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  res.json({
    id: user._id.toString(),
    _id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    specialization: user.specialization
  });
});

exports.getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id).select('-password');
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  res.json({
    user: {
      id: user._id.toString(),
      _id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      specialization: user.specialization
    }
  });
});

exports.getDoctors = asyncHandler(async (req, res, next) => {
  const doctors = await User.find({ role: 'doctor' }).select('-password');
  
  const doctorsWithId = doctors.map(doctor => ({
    id: doctor._id.toString(),
    _id: doctor._id.toString(),
    name: doctor.name,
    email: doctor.email,
    role: doctor.role,
    specialization: doctor.specialization
  }));
  
  res.json(doctorsWithId);
});
