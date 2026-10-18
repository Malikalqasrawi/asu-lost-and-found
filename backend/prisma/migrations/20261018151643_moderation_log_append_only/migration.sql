-- The log records decisions: the API's login may add entries but never change
-- or delete them. The default privileges gave it both, so they are taken back.
REVOKE UPDATE, DELETE, TRUNCATE ON "moderation_log" FROM lostfound_app;
