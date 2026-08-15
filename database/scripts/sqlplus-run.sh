#!/usr/bin/env bash
# ResumeIQ Oracle SQL runner.
#
# Executes one committed .sql file through SQL*Plus inside the ResumeIQ Oracle
# container. All credentials arrive as RIQ_ORA_* environment variables set at
# runtime by the migration runner / verify script — no password is stored in
# any committed file, on any command line, or in the container process args.
#
# RIQ_SQL_FILE  absolute path inside the container (a read-only bind mount)
# RIQ_SQL_ARGS  optional space-separated positional args for @file (&1 &2 ...)
#
# CONNECT is piped on stdin (not argv) so credentials never show in `ps`.
# `-L` (silent login) makes a bad CONNECT exit non-zero instead of prompting.
set -euo pipefail

: "${RIQ_ORA_USER:?RIQ_ORA_USER is required}"
: "${RIQ_ORA_PASSWORD:?RIQ_ORA_PASSWORD is required}"
: "${RIQ_ORA_CONNECT:?RIQ_ORA_CONNECT is required}"
: "${RIQ_SQL_FILE:?RIQ_SQL_FILE is required}"

SQLPLUS_BIN=""
if command -v sqlplus >/dev/null 2>&1; then
  SQLPLUS_BIN="$(command -v sqlplus)"
elif [ -n "${ORACLE_HOME:-}" ] && [ -x "${ORACLE_HOME}/bin/sqlplus" ]; then
  SQLPLUS_BIN="${ORACLE_HOME}/bin/sqlplus"
else
  SQLPLUS_BIN="$(find /opt/oracle -name sqlplus -type f 2>/dev/null | head -n 1)"
fi

if [ -z "${SQLPLUS_BIN}" ]; then
  echo "[sqlplus-run] sqlplus not found in container" >&2
  exit 1
fi

printf 'CONNECT "%s"/"%s"@%s\n@%s%s\nexit\n' \
  "${RIQ_ORA_USER}" \
  "${RIQ_ORA_PASSWORD}" \
  "${RIQ_ORA_CONNECT}" \
  "${RIQ_SQL_FILE}" \
  "${RIQ_SQL_ARGS:+ ${RIQ_SQL_ARGS}}" \
  | "${SQLPLUS_BIN}" -s -L /nolog
