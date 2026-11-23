// Репозиторій завдань.

const TASK_COLUMNS = `
  t.id, t.project_id AS "projectId", t.title, t.description, t.deadline, t.status,
  t.assignee_id AS "assigneeId", u.name AS "assigneeName", t.created_at AS "createdAt"`;

export function createTaskRepository(db) {
  const one = async (sql, params) => (await db.query(sql, params)).rows[0] || null;

  const findById = (id) =>
    one(
      `SELECT ${TASK_COLUMNS}, p.name AS "projectName"
       FROM tasks t JOIN users u ON u.id = t.assignee_id JOIN projects p ON p.id = t.project_id
       WHERE t.id = $1`,
      [id]
    );

  return {
    findById,

    listByProject: async (projectId) =>
      (
        await db.query(
          `SELECT ${TASK_COLUMNS}
           FROM tasks t JOIN users u ON u.id = t.assignee_id
           WHERE t.project_id = $1
           ORDER BY t.deadline NULLS LAST, t.created_at`,
          [projectId]
        )
      ).rows,

    // Власні завдання користувача з усіх проєктів (FR-11).
    listByAssignee: async (userId) =>
      (
        await db.query(
          `SELECT ${TASK_COLUMNS}, p.name AS "projectName"
           FROM tasks t JOIN users u ON u.id = t.assignee_id JOIN projects p ON p.id = t.project_id
           WHERE t.assignee_id = $1
           ORDER BY t.deadline NULLS LAST, t.created_at`,
          [userId]
        )
      ).rows,

    create: async ({ projectId, title, description, deadline, status, assigneeId }) => {
      const row = await one(
        `INSERT INTO tasks (project_id, title, description, deadline, status, assignee_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [projectId, title, description, deadline, status, assigneeId]
      );
      return findById(row.id);
    },

    update: async (id, { title, description, deadline, status, assigneeId }) => {
      const row = await one(
        `UPDATE tasks SET title = $2, description = $3, deadline = $4, status = $5, assignee_id = $6
         WHERE id = $1 RETURNING id`,
        [id, title, description, deadline, status, assigneeId]
      );
      return row ? findById(row.id) : null;
    },

    updateStatus: async (id, status) => {
      const row = await one(`UPDATE tasks SET status = $2 WHERE id = $1 RETURNING id`, [id, status]);
      return row ? findById(row.id) : null;
    },

    delete: async (id) => (await db.query(`DELETE FROM tasks WHERE id = $1`, [id])).rowCount > 0,
  };
}
