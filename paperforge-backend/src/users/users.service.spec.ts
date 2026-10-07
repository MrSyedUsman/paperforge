import { normaliseUsername } from './users.service.js';

describe('normaliseUsername', () => {
  it('trims and lowercases', () => {
    expect(normaliseUsername('  Forge ')).toBe('forge');
  });
});
