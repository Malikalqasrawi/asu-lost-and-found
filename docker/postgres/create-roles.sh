#!/bin/sh
# Runs once, when the database volume is created, as the superuser.
# lostfound owns the database and runs the migrations; lostfound_app is the
# login the API uses. Neither is a superuser. The grants on tables come from
# the first Prisma migration. lostfound_shadow is a scratch database that
# `prisma migrate dev` uses to check new migrations.
set -eu

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  -v owner_password="$DB_PASSWORD" \
  -v app_password="$DB_APP_PASSWORD" <<'SQL'
CREATE ROLE lostfound LOGIN PASSWORD :'owner_password';
CREATE ROLE lostfound_app LOGIN PASSWORD :'app_password';
ALTER DATABASE lostfound OWNER TO lostfound;
ALTER SCHEMA public OWNER TO lostfound;
CREATE DATABASE lostfound_shadow OWNER lostfound;
REVOKE CONNECT ON DATABASE lostfound_shadow FROM PUBLIC;
SQL
