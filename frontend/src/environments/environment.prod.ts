export const environment = {
  production: true,
  apiUrl: '/api/v1',
  /**
   * Production must never use localStorage-backed mock repositories.
   * Real HTTP repository implementations must be provided instead.
   */
  useMockApi: false,
};
