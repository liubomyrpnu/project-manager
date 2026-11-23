export function createAdminController({ adminService }) {
  return {
    listUsers: async (req, res) => res.json(await adminService.listUsers()),
    setBlocked: async (req, res) => res.json(await adminService.setBlocked(req.user, req.params.id, req.body ?? {})),
    unlock: async (req, res) => res.json(await adminService.unlock(req.params.id)),
    loginAttempts: async (req, res) => res.json(await adminService.listLoginAttempts(req.query)),
    loginSummary: async (req, res) => res.json(await adminService.loginSummary(req.query)),
  };
}
