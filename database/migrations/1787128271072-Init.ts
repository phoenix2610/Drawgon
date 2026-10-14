import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1787128271072 implements MigrationInterface {
    name = 'Init1787128271072'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."boards_visibility_enum" AS ENUM('private', 'public')`);
        await queryRunner.query(`CREATE TABLE "boards" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "owner_id" uuid NOT NULL, "title" character varying(255) NOT NULL, "visibility" "public"."boards_visibility_enum" NOT NULL DEFAULT 'private', "snapshot" jsonb NOT NULL DEFAULT '{}', "thumbnail_url" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_606923b0b068ef262dfdcd18f44" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a20a7418b96eda28e131840847" ON "boards"  ("owner_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_a20a7418b96eda28e131840847"`);
        await queryRunner.query(`DROP TABLE "boards"`);
        await queryRunner.query(`DROP TYPE "public"."boards_visibility_enum"`);
    }

}
