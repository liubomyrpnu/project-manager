import { badRequest, forbidden, notFound, throwIfInvalid } from '../errors/AppError.js';
import {
  getDeadlineState,
  isUuid,
  trimOrNull,
  validateDeadline,
  validateStatus,
  validateText,
} from '../validation/validators.js';

// Бізнес-логіка завдань і Kanban-дошки (FR-07 … FR-12).
export function createTaskService({ tasks, projects, projectService, now = () => new Date() }) {
  const withDeadlineState = (task) => ({ ...task, deadlineState: getDeadlineState(task.deadline, task.status, now()) });

  function validateTask(body) {
    throwIfInvalid({
      title: validateText(body.title, { label: 'Назва', min: 3, max: 200 }),
      description: validateText(body.description, { label: 'Опис', max: 5000, required: false }),
      deadline: validateDeadline(body.deadline),
      status: body.status === undefined ? '' : validateStatus(body.status),
      assigneeId: isUuid(body.assigneeId) ? '' : 'Оберіть виконавця',
    });
  }

  // Виконавець завдання має бути учасником відповідного проєкту (правило з лаб. №5).
  async function assertAssigneeIsMember(projectId, assigneeId) {
    if (!(await projects.findMemberRole(projectId, assigneeId))) {
      throw badRequest('Виконавець має бути учасником проєкту', { assigneeId: 'Виконавець має бути учасником проєкту' });
    }
  }

  async function getTaskWithRole(user, taskId) {
    const task = isUuid(taskId) ? await tasks.findById(taskId) : null;
    if (!task) throw notFound('Завдання не знайдено');
    const role = await projects.findMemberRole(task.projectId, user.id);
    if (!role) throw forbidden('Ви не є учасником проєкту цього завдання');
    return { task, role };
  }

  const toData = (body) => ({
    title: body.title.trim(),
    description: trimOrNull(body.description),
    deadline: body.deadline || null,
    status: body.status ?? 'todo',
    assigneeId: body.assigneeId,
  });

  return {
    async listByProject(user, projectId) {
      await projectService.requireRole(user.id, projectId);
      return (await tasks.listByProject(projectId)).map(withDeadlineState);
    },

    async listMine(user) {
      return (await tasks.listByAssignee(user.id)).map(withDeadlineState);
    },

    async create(user, projectId, body) {
      await projectService.requireRole(user.id, projectId, 'manager');
      validateTask(body);
      await assertAssigneeIsMember(projectId, body.assigneeId);
      return withDeadlineState(await tasks.create({ projectId, ...toData(body) }));
    },

    async update(user, taskId, body) {
      const { task, role } = await getTaskWithRole(user, taskId);
      if (role !== 'manager') throw forbidden('Редагувати завдання може лише менеджер проєкту');
      validateTask(body);
      await assertAssigneeIsMember(task.projectId, body.assigneeId);
      return withDeadlineState(await tasks.update(task.id, { ...toData(body), status: body.status ?? task.status }));
    },

    // Змінити статус (перемістити картку) може менеджер або виконавець завдання (FR-10).
    async changeStatus(user, taskId, body) {
      throwIfInvalid({ status: validateStatus(body.status) });
      const { task, role } = await getTaskWithRole(user, taskId);
      if (role !== 'manager' && task.assigneeId !== user.id) {
        throw forbidden('Змінити статус може лише виконавець завдання або менеджер проєкту');
      }
      return withDeadlineState(await tasks.updateStatus(task.id, body.status));
    },

    async remove(user, taskId) {
      const { task, role } = await getTaskWithRole(user, taskId);
      if (role !== 'manager') throw forbidden('Видалити завдання може лише менеджер проєкту');
      await tasks.delete(task.id);
    },
  };
}
