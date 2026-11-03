#!/bin/sh
# Runs once, when the database volume is first created: a separate database
# and user for Keycloak, next to the app's.
set -eu
mysql -uroot -p"$MYSQL_ROOT_PASSWORD" <<SQL
CREATE DATABASE IF NOT EXISTS keycloak CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'keycloak'@'%' IDENTIFIED BY '${KEYCLOAK_DB_PASSWORD}';
GRANT ALL ON keycloak.* TO 'keycloak'@'%';
SQL
