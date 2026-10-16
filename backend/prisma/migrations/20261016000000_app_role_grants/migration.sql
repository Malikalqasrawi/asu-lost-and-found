-- The lostfound_app login is created when the database is first set up
-- (docker/postgres/create-roles.sh). Every table and sequence the owner
-- creates from now on is usable by it, but it can't change the schema.
GRANT USAGE ON SCHEMA public TO lostfound_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO lostfound_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO lostfound_app;
