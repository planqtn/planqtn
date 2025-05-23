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
  // Create tasks table
  pgm.createTable(
    { name: "tasks" },
    {
      uuid: {
        type: "uuid",
        primaryKey: true,
        default: pgm.func("gen_random_uuid()"),
      },
      user_id: {
        type: "uuid",
        notNull: true,
      },
      execution_id: {
        type: "string",
        notNull: false,
      },
      job_type: {
        type: "string",
        notNull: true,
      },
      sent_at: {
        type: "timestamp with time zone",
      },
      started_at: {
        type: "timestamp without time zone",
      },
      ended_at: {
        type: "timestamp without time zone",
      },
      state: {
        type: "smallint",
      },
      args: {
        type: "json",
      },
      result: {
        type: "json",
      },
    }
  );

  // Enable RLS
  pgm.sql("ALTER TABLE tasks ENABLE ROW LEVEL SECURITY");

  // Create RLS policies
  pgm.createPolicy({ name: "tasks" }, "INSERT user's own rows only", {
    command: "INSERT",
    role: "public",
    check: "((SELECT auth.uid()) = user_id)",
  });

  pgm.createPolicy({ name: "tasks" }, "SELECT user's own rows only", {
    command: "SELECT",
    role: "public",
    using: "((SELECT auth.uid()) = user_id)",
  });

  pgm.createPolicy({ name: "tasks" }, "UPDATE user's own rows only", {
    command: "UPDATE",
    role: "public",
    using: "((SELECT auth.uid()) = user_id)",
  });

  pgm.sql("alter publication supabase_realtime add table tasks;")

  pgm.createTable(
    { name: "task_updates" },
    {
      uuid: {
        type: "uuid",
        primaryKey: true,
        default: pgm.func("gen_random_uuid()"),
      },
      user_id: {
        type: "uuid",
        notNull: true,
      },
      updates: {
        type: "json",
      },
    }
  );

  pgm.createPolicy({ name: "task_updates" }, "SELECT user's own rows only", {
    command: "SELECT",
    role: "public",
    using: "((SELECT auth.uid()) = user_id)",
  });
  pgm.sql("ALTER TABLE task_updates ENABLE ROW LEVEL SECURITY");
  pgm.sql("alter publication supabase_realtime add table task_updates;")

};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  // Drop policies
  pgm.dropPolicy({ name: "tasks" }, "INSERT user's own rows only");
  pgm.dropPolicy({ name: "tasks" }, "SELECT user's own rows only");
  pgm.dropPolicy({ name: "tasks" }, "UPDATE user's own rows only");

  // Drop table
  pgm.dropTable("tasks");
  pgm.dropTable("task_updates");
};
