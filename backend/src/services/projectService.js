import { conflict, forbidden, notFound, throwIfInvalid } from '../errors/AppError.js';
import { isUuid, normalizeEmail, trimOrNull, validateEmail, validateProjectRole, validateText } from '../validation/validators.js';

// Бізнес-логіка проєктів та учасників (FR-03 … FR-06).
// Права перевіряються на сервері за роллю користувача в проєкті (NFR-03).
export function createProjectService({ projects, users }) {
  const validateProject = (body) =>
    throwIfInvalid({
      name: validateText(body.name, { label: 'Назва', min: 3, max: 150 }),
      description: validateText(body.description, { label: 'Опис', max: 2000, required: false }),
    });

  // Повертає роль користувача в проєкті або кидає 404/403.
  async function requireRole(userId, projectId, requiredRole = null) {
    if (!isUuid(projectId)) throw notFound('Проєкт не знайдено');
    const project = await projects.findById(projectId);
    if (!project) throw notFound('Проєкт не знайдено');
    const role = await projects.findMemberRole(projectId, userId);
    if (!role) throw forbidden('Ви не є учасником цього проєкту');
    if (requiredRole === 'manager' && role !== 'manager') throw forbidden('Ця дія доступна лише менеджеру проєкту');
    return { project, role };
  }

  return {
    requireRole,

    listForUser: (user) => projects.listForUser(user.id),

    // Автор нового проєкту автоматично стає його менеджером.
    async create(user, body) {
      validateProject(body);
      const project = await projects.createWithManager({
        name: body.name.trim(),
        description: trimOrNull(body.description),
        managerId: user.id,
      });
      return { ...project, myRole: 'manager' };
    },

    async get(user, projectId) {
      const { project, role } = await requireRole(user.id, projectId);
      return { ...project, myRole: role };
    },

    async update(user, projectId, body) {
      await requireRole(user.id, projectId, 'manager');
      validateProject(body);
      const project = await projects.update(projectId, { name: body.name.trim(), description: trimOrNull(body.description) });
      return { ...project, myRole: 'manager' };
    },

    // Разом із проєктом каскадно видаляються його завдання та записи про учасників.
    async remove(user, projectId) {
      await requireRole(user.id, projectId, 'manager');
      await projects.delete(projectId);
    },

    async listMembers(user, projectId) {
      await requireRole(user.id, projectId);
      return projects.listMembers(projectId);
    },

    async addMember(user, projectId, body) {
      await requireRole(user.id, projectId, 'manager');
      const role = body.role ?? 'member';
      throwIfInvalid({ email: validateEmail(body.email), role: validateProjectRole(role) });

      const member = await users.findByEmail(normalizeEmail(body.email));
      if (!member) throw notFound('Користувача з такою поштою не знайдено');
      if (await projects.findMemberRole(projectId, member.id)) throw conflict('Користувач уже є учасником проєкту');

      await projects.addMember(projectId, member.id, role);
      return projects.listMembers(projectId);
    },

    async removeMember(user, projectId, memberId) {
      await requireRole(user.id, projectId, 'manager');
      const role = isUuid(memberId) ? await projects.findMemberRole(projectId, memberId) : null;
      if (!role) throw notFound('Учасника не знайдено');
      if (role === 'manager' && (await projects.countManagers(projectId)) <= 1) {
        throw conflict('Не можна видалити єдиного менеджера проєкту');
      }
      if ((await projects.countAssignedTasks(projectId, memberId)) > 0) {
        throw conflict('Учаснику призначено завдання проєкту. Спочатку перепризначте або видаліть їх.');
      }
      await projects.removeMember(projectId, memberId);
      return projects.listMembers(projectId);
    },
  };
}
