import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hand-written from better-auth's own computed schema for our exact config
 * (`getSchema({ emailAndPassword: { enabled: true } })` in the installed
 * better-auth@1.7.1), rather than generated via the `@better-auth/cli`
 * package — that package is currently flagged deprecated by the npm
 * registry itself ("no longer supported... contact Support"), which reads
 * as a registry-side flag rather than an ordinary author deprecation, so it
 * was avoided rather than executed against this project's database.
 *
 * better-auth manages these tables' rows itself (ids, hashing, etc.) — this
 * migration only needs to own the DDL so TypeORM's migration history stays
 * the single source of truth for "what tables exist" (see PROGRESS.md).
 */
export class BetterAuthSchema1787132263693 implements MigrationInterface {
  name = 'BetterAuthSchema1787132263693';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user" (
        "id" text PRIMARY KEY,
        "name" text NOT NULL,
        "email" text NOT NULL,
        "emailVerified" boolean NOT NULL,
        "image" text,
        "createdAt" timestamptz NOT NULL,
        "updatedAt" timestamptz NOT NULL,
        CONSTRAINT "UQ_user_email" UNIQUE ("email")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "session" (
        "id" text PRIMARY KEY,
        "expiresAt" timestamptz NOT NULL,
        "token" text NOT NULL,
        "createdAt" timestamptz NOT NULL,
        "updatedAt" timestamptz NOT NULL,
        "ipAddress" text,
        "userAgent" text,
        "userId" text NOT NULL,
        CONSTRAINT "UQ_session_token" UNIQUE ("token"),
        CONSTRAINT "FK_session_user" FOREIGN KEY ("userId")
          REFERENCES "user" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "account" (
        "id" text PRIMARY KEY,
        "issuer" text NOT NULL,
        "accountId" text NOT NULL,
        "providerId" text NOT NULL,
        "userId" text NOT NULL,
        "accessToken" text,
        "refreshToken" text,
        "idToken" text,
        "accessTokenExpiresAt" timestamptz,
        "refreshTokenExpiresAt" timestamptz,
        "scope" text,
        "password" text,
        "createdAt" timestamptz NOT NULL,
        "updatedAt" timestamptz NOT NULL,
        CONSTRAINT "FK_account_user" FOREIGN KEY ("userId")
          REFERENCES "user" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "verification" (
        "id" text PRIMARY KEY,
        "identifier" text NOT NULL,
        "value" text NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL,
        "updatedAt" timestamptz NOT NULL
      )
    `);

    // Dev-only boards created under Phase 2's placeholder DEV_USER_ID have
    // no matching row in the new `user` table and would violate the FK
    // added below — safe to drop, they're throwaway local test data.
    await queryRunner.query(
      `DELETE FROM "boards" WHERE "owner_id" = '00000000-0000-0000-0000-000000000001'`,
    );

    // boards.owner_id was a plain uuid column with no FK (Phase 0/2, before
    // better-auth's user table existed). better-auth's own ids are opaque
    // strings, not uuids, so this also widens the column type to match.
    await queryRunner.query(
      `ALTER TABLE "boards" ALTER COLUMN "owner_id" TYPE text`,
    );
    await queryRunner.query(`
      ALTER TABLE "boards"
      ADD CONSTRAINT "FK_boards_owner" FOREIGN KEY ("owner_id")
        REFERENCES "user" ("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "boards" DROP CONSTRAINT "FK_boards_owner"`,
    );
    await queryRunner.query(
      `ALTER TABLE "boards" ALTER COLUMN "owner_id" TYPE uuid USING "owner_id"::uuid`,
    );
    await queryRunner.query(`DROP TABLE "verification"`);
    await queryRunner.query(`DROP TABLE "account"`);
    await queryRunner.query(`DROP TABLE "session"`);
    await queryRunner.query(`DROP TABLE "user"`);
  }
}
