const redisCache = require('./redisClient');

/**
 * Generate a random OTP or token
 * @param {number} length - Length of the token
 * @returns {string} Random alphanumeric string
 */
function generateRandomToken(length = 6) {
  const chars = '0123456789';
  let token = '';
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

const tempTokenManager = {
  /**
   * Generate and store OTP for user
   * @param {string} email - User email
   * @param {number} ttl - Time to live in seconds (default: 10 min)
   * @returns {Promise<string>} The generated OTP
   */
  generateOTP: async (email, ttl = 600) => {
    const otp = generateRandomToken(6);
    await redisCache.setTempToken('otp', email, otp, ttl);
    return otp;
  },

  /**
   * Verify OTP
   * @param {string} email - User email
   * @param {string} otp - OTP to verify
   * @returns {Promise<boolean>} True if OTP is valid
   */
  verifyOTP: async (email, otp) => {
    return redisCache.verifyTempToken('otp', email, otp);
  },

  /**
   * Generate and store password reset token
   * @param {string} email - User email
   * @param {number} ttl - Time to live in seconds (default: 30 min)
   * @returns {Promise<string>} The generated token
   */
  generatePasswordResetToken: async (email, ttl = 1800) => {
    const token = generateRandomToken(32);
    await redisCache.setTempToken('password_reset', email, token, ttl);
    return token;
  },

  /**
   * Verify password reset token
   * @param {string} email - User email
   * @param {string} token - Token to verify
   * @returns {Promise<boolean>} True if token is valid
   */
  verifyPasswordResetToken: async (email, token) => {
    return redisCache.verifyTempToken('password_reset', email, token);
  },

  /**
   * Generate and store email verification token
   * @param {string} email - User email
   * @param {number} ttl - Time to live in seconds (default: 24 hours)
   * @returns {Promise<string>} The generated token
   */
  generateEmailVerificationToken: async (email, ttl = 86400) => {
    const token = generateRandomToken(32);
    await redisCache.setTempToken('email_verify', email, token, ttl);
    return token;
  },

  /**
   * Verify email verification token
   * @param {string} email - User email
   * @param {string} token - Token to verify
   * @returns {Promise<boolean>} True if token is valid
   */
  verifyEmailVerificationToken: async (email, token) => {
    return redisCache.verifyTempToken('email_verify', email, token);
  },

  /**
   * Delete temp token (useful after verification fails multiple times)
   * @param {string} tokenType - Type of token ('otp', 'password_reset', 'email_verify')
   * @param {string} identifier - Email or identifier
   * @returns {Promise<void>}
   */
  deleteTempToken: async (tokenType, identifier) => {
    return redisCache.deleteTempToken(tokenType, identifier);
  }
};

module.exports = tempTokenManager;
