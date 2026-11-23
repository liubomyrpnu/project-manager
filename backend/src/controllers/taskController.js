export function createTaskController({ taskService }) {
  const body = (req) => req.body ?? {};

  return {
    mine: async (req, res) => res.json(await taskService.listMine(req.user)),
    update: async (req, res) => res.json(await taskService.update(req.user, req.params.id, body(req))),
    changeStatus: async (req, res) => res.json(await taskService.changeStatus(req.user, req.params.id, body(req))),
    remove: async (req, res) => {
      await taskService.remove(req.user, req.params.id);
      res.status(204).end();
    },
  };
}
