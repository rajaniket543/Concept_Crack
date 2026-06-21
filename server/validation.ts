import type { NextFunction, Request, Response } from 'express';
import { z, type ZodType } from 'zod';

/**
 * Express middleware that validates `req.body` against a Zod schema.
 *
 * On failure it responds `400` with field-level messages in the standard
 * error envelope. On success it replaces `req.body` with the parsed value
 * (typed, with unknown keys stripped).
 */
export function validateBody(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      const fields: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || '(body)';
        if (!fields[key]) fields[key] = issue.message;
      }
      return res.status(400).json({
        ok: false,
        error: { message: 'Invalid request.', fields },
      });
    }
    req.body = result.data;
    return next();
  };
}

const roleSchema = z.enum(['student', 'parent', 'faculty', 'admin']);

export const authSchemas = {
  login: z.object({
    identifier: z.string().min(1, 'Identifier is required.'),
    role: roleSchema,
    method: z.enum(['email', 'mobile', 'otp']).default('email'),
    password: z.string().optional(),
  }),
  requestOtp: z.object({
    identifier: z.string().min(1, 'Identifier is required.'),
    role: roleSchema,
  }),
  verifyOtp: z.object({
    challengeId: z.string().min(1, 'challengeId is required.'),
    code: z.string().min(1, 'code is required.'),
  }),
  forgotPassword: z.object({
    identifier: z.string().min(1, 'Identifier is required.'),
  }),
  resetPassword: z.object({
    resetToken: z.string().min(1, 'resetToken is required.'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters.'),
  }),
};
