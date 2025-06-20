/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {

    pgm.sql("ALTER ROLE authenticator SET pgrst.db_aggregates_enabled = 'true'");
    pgm.sql("NOTIFY pgrst, 'reload config'");
 
    

};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {

    pgm.sql("ALTER ROLE authenticator SET pgrst.db_aggregates_enabled = 'false'");
    pgm.sql("NOTIFY pgrst, 'reload config'");

};
