import { betterAuth } from 'better-auth';
import { PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { getDatabaseSsl } from '../../config/database-ssl';
import { getFrontendOrigins } from '../../config/frontend-origins';

const isProduction = process.env.NODE_ENV === 'production';

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: {
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: getDatabaseSsl(),
      }),
    }),
    type: 'postgres',
  },
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: getFrontendOrigins(),
  ...(isProduction && {
    advanced: {
      defaultCookieAttributes: {
        sameSite: 'none' as const,
        secure: true,

        partitioned: true,
      },
    },
  }),
});
