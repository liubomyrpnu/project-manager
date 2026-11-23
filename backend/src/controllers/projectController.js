export function createProjectController({ projectService, taskService }) {
  const body = (req) => req.body ?? {};

  return {
    list: async (req, res) => res.json(await projectService.listForUser(req.user)),
    create: async (req, res) => res.status(201).json(await projectService.create(req.user, body(req))),
    get: async (req, res) => res.json(await projectService.get(req.user, req.params.id)),
    update: async (req, res) => res.json(await projectService.update(req.user, req.params.id, body(req))),
    remove: async (req, res) => {
      await projectService.remove(req.user, req.params.id);
      res.status(204).end();
    },

    listMembers: async (req, res) => res.json(await projectService.listMembers(req.user, req.params.id)),
    addMember: async (req, res) => res.status(201).json(await projectService.addMember(req.user, req.params.id, body(req))),
    removeMember: async (req, res) =>
      res.json(await projectService.removeMember(req.user, req.params.id, req.params.userId)),

    listTasks: async (req, res) => res.json(await taskService.listByProject(req.user, req.params.id)),
    createTask: async (req, res) => res.status(201).json(await taskService.create(req.user, req.params.id, body(req))),
  };
}
