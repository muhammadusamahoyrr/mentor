// Generic validation middleware: runs a Zod schema against req.body.
// On failure it returns 400 with a readable list of problems.
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const details = result.error.issues.map(
      (issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`
    );
    return res.status(400).json({ error: 'Validation failed', details });
  }

  // Replace body with the parsed/coerced data.
  req.body = result.data;
  next();
};

module.exports = { validate };
