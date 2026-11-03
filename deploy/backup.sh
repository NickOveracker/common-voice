#!/bin/sh
# Dumps both databases (the archive's and Keycloak's) every night, keeping
# the last 14 nights. The audio itself is in ./data/storage: copy that
# folder to another disk or machine as well (see README.md).
set -u
while true; do
  stamp=$(date +%Y-%m-%d)
  for database in voiceweb keycloak; do
    mysqldump -h db -u root --single-transaction --routines --triggers \
      "$database" | gzip > "/backups/$database-$stamp.sql.gz.tmp" &&
      mv "/backups/$database-$stamp.sql.gz.tmp" "/backups/$database-$stamp.sql.gz"
  done
  for database in voiceweb keycloak; do
    ls -1t /backups/$database-*.sql.gz | tail -n +15 | while read -r old; do
      rm -f "$old"
    done
  done
  sleep 86400
done
