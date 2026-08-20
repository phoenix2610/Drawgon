import { betterAuth } from 'better-auth';
import { PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { getDatabaseSsl } from '../../config/database-ssl';

export const auth = betterAuth({
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
  trustedOrigins: [process.env.FRONTEND_URL ?? 'http://localhost:5173'],
});
