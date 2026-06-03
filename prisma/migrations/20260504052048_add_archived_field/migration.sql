/*
  Warnings:

  - You are about to drop the column `isArchived` on the `Request` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Request" DROP COLUMN "isArchived",
ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false;
