#!/bin/sh
# Executado somente na primeira inicialização do volume: cria o banco de testes
# ao lado do banco de desenvolvimento.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
	SELECT 'CREATE DATABASE "${POSTGRES_TEST_DB}"'
	WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${POSTGRES_TEST_DB}')\gexec
EOSQL
