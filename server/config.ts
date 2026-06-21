import { z } from 'zod';

/**
 * Centralised, validated runtime configuration.
 *
 * Every environment variable the server depends on is declared (and defaulted)
 * here exactly once. If something required is malformed the process refuses to
 * start with a clear message instead of failing mysteriously later.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(8787),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  // Comma-separated list of browser origins allowed by CORS (production).
  ALLOWED_ORIGINS: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.') || '(root)'}: ${issue.message}`);
  }
  process.exit(1);
}

const env = parsed.data;

export const config = {
  nodeEnv: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  redisUrl: env.REDIS_URL,
  /** Origins permitted by CORS. Empty in dev → all origins are allowed. */
  allowedOrigins: (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  /**
   * Whether dev-only convenience values (OTP codes, password-reset tokens) may
   * be returned in API responses. Must never be true in production.
   */
  exposeDevCodes: env.NODE_ENV !== 'production',
};

export type AppConfig = typeof config;
