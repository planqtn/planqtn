/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = async (pgm) => {
  // Get all existing users from auth.users
  const { rows: users } = await pgm.db.query('SELECT id FROM auth.users');
  
  
  // Insert quotas and initial usage for each user
  for (const user of users) {
    // Insert quota
    const { rows: [quota] } = await pgm.db.query(
      `INSERT INTO quotas (id, user_id, quota_type, monthly_limit)
       VALUES (gen_random_uuid(), $1, 'cloud-run-minutes', 500)
       RETURNING id`,
      [user.id]
    );
    
  }
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = async (pgm) => {
  // Remove all quota usage records
  await pgm.db.query('DELETE FROM quota_usage');
  // Remove all quota records
  await pgm.db.query('DELETE FROM quotas');
}; 