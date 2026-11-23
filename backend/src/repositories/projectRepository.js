// Репозиторій проєктів та їх учасників.

const PROJECT_COLUMNS = `p.id, p.name, p.description, p.created_at AS "createdAt"`;

export function createProjectRepository(db) {
  const one = async (sql, params) => (await db.query(sql, params)).rows[0] || null;

  return {
    // Проєкти, у яких користувач є учасником, з його роллю та статистикою завдань.
    listForUser: async (userId) =>
      (
        await db.query(
          `SELECT ${PROJECT_COLUMNS}, pm.role AS "myRole",
                  (SELECT count(*)::int FROM project_members m WHERE m.project_id = p.id) AS "memberCount",
                  (SELECT count(*)::int FROM tasks t WHERE t.project_id = p.id) AS "taskCount",
                  (SELECT count(*)::int FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') AS "doneCount"
           FROM projects p
           JOIN project_members pm ON pm.project_id = p.id
           WHERE pm.user_id = $1
           ORDER BY p.created_at DESC, p.name`,
          [userId]
        )
      ).rows,

    findById: (id) => one(`SELECT ${PROJECT_COLUMNS} FROM projects p WHERE p.id = $1`, [id]),

    // Створення проєкту та призначення автора менеджером одним SQL-запитом (атомарно).
    createWithManager: ({ name, description, managerId }) =>
      one(
        `WITH p AS (
           INSERT INTO projects (name, description) VALUES ($1, $2)
           RETURNING id, name, description, created_at
         ), m AS (
           INSERT INTO project_members (project_id, user_id, role)
           SELECT id, $3, 'manager' FROM p
         )
         SELECT id, name, description, created_at AS "createdAt" FROM p`,
        [name, description, managerId]
      ),

    update: (id, { name, description }) =>
      one(
        `UPDATE projects p SET name = $2, description = $3 WHERE p.id = $1 RETURNING ${PROJECT_COLUMNS}`,
        [id, name, description]
      ),

    delete: async (id) => (await db.query(`DELETE FROM projects WHERE id = $1`, [id])).rowCount > 0,

    // --- Учасники ---
    findMemberRole: async (projectId, userId) =>
      (await one(`SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2`, [projectId, userId]))
        ?.role || null,

    listMembers: async (projectId) =>
      (
        await db.query(
          `SELECT u.id AS "userId", u.name, u.email, pm.role, pm.joined_at AS "joinedAt"
           FROM project_members pm
           JOIN users u ON u.id = pm.user_id
           WHERE pm.project_id = $1
           ORDER BY CASE pm.role WHEN 'manager' THEN 0 ELSE 1 END, u.name`,
          [projectId]
        )
      ).rows,

    addMember: (projectId, userId, role) =>
      db.query(`INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)`, [projectId, userId, role]),

    removeMember: async (projectId, userId) =>
      (await db.query(`DELETE FROM project_members WHERE project_id = $1 AND user_id = $2`, [projectId, userId]))
        .rowCount > 0,

    countManagers: async (projectId) =>
      (await one(`SELECT count(*)::int AS n FROM project_members WHERE project_id = $1 AND role = 'manager'`, [projectId]))
        .n,

    countAssignedTasks: async (projectId, userId) =>
      (await one(`SELECT count(*)::int AS n FROM tasks WHERE project_id = $1 AND assignee_id = $2`, [projectId, userId]))
        .n,
  };
}
