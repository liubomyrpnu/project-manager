export function createProfileController({ profileService }) {
  const body = (req) => req.body ?? {};

  return {
    me: (req, res) => res.json(profileService.getProfile(req.user)),
    updateName: async (req, res) => res.json(await profileService.updateName(req.user, body(req))),
    changePassword: async (req, res) => res.json(await profileService.changePassword(req.user, body(req))),
    setupTwoFactor: async (req, res) => res.json(await profileService.setupTwoFactor(req.user)),
    enableTwoFactor: async (req, res) => res.json(await profileService.enableTwoFactor(req.user, body(req))),
    disableTwoFactor: async (req, res) => res.json(await profileService.disableTwoFactor(req.user, body(req))),
  };
}
