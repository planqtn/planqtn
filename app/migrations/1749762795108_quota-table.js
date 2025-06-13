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
  // Create the quotas table
  pgm.createTable('quotas', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()')
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: '"auth"."users"',
      onDelete: 'CASCADE'
    },
    quota_type: {
      type: 'varchar(50)',
      notNull: true
    },
    monthly_limit: {
      type: 'integer',
      notNull: true
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('now()')
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('now()')
    }
  });

  // Create the quota_usage table to track monthly usage
  pgm.createTable('quota_usage', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()')
    },
    quota_id: {
      type: 'uuid',
      notNull: true,
      references: 'quotas',
      onDelete: 'CASCADE'
    },
    usage_date: {
      type: 'date',
      notNull: true
    },
    amount_used: {
      type: 'integer',
      notNull: true,
      default: 0
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('now()')
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('now()')
    }
  });

  // Add indexes for better query performance
  pgm.createIndex('quotas', ['user_id', 'quota_type'], { unique: true });
  pgm.createIndex('quota_usage', ['quota_id', 'usage_date']);

  // Enable Row Level Security
  pgm.sql('ALTER TABLE quotas ENABLE ROW LEVEL SECURITY');
  pgm.sql('ALTER TABLE quota_usage ENABLE ROW LEVEL SECURITY');

  // Create policies that only allow service role access
  pgm.sql(`
    CREATE POLICY "Service role only access on quotas"
    ON quotas
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'service_role')
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role')
  `);

  pgm.sql(`
    CREATE POLICY "Service role only access on quota_usage"
    ON quota_usage
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'service_role')
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role')
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  // Drop policies first
  pgm.sql('DROP POLICY IF EXISTS "Service role only access on quotas" ON quotas');
  pgm.sql('DROP POLICY IF EXISTS "Service role only access on quota_usage" ON quota_usage');
  
  // Then drop tables
  pgm.dropTable('quota_usage');
  pgm.dropTable('quotas');
};
