export const environment = {
  production: false,
  apiUrl: '/api/v1',
  /**
   * Mock-first UI milestone: when true, repository providers return
   * localStorage-backed mock implementations. Later, flipping this to
   * false swaps in HTTP repositories without any component changes.
   */
  useMockApi: true,
};
