-- One signed-in device per user. Signing in elsewhere replaces the session; keep only the newest row per user first.
DELETE FROM "Session" s
USING "Session" newer
WHERE s."userId" = newer."userId"
  AND (s."createdAt", s."id") < (newer."createdAt", newer."id");

DROP INDEX IF EXISTS "Session_userId_idx";
CREATE UNIQUE INDEX "Session_userId_key" ON "Session"("userId");
