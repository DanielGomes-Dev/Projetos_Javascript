// tests/unit/asyncHandler.test.js
const asyncHandler = require('../../src/utils/asyncHandler');

describe('asyncHandler', () => {
  it('chama a função original com (req, res, next)', async () => {
    const fn = jest.fn().mockResolvedValue(undefined);
    const req = {};
    const res = {};
    const next = jest.fn();

    await asyncHandler(fn)(req, res, next);

    expect(fn).toHaveBeenCalledWith(req, res, next);
  });

  it('encaminha uma rejeição para next(err), sem lançar', async () => {
    const error = new Error('falhou');
    const fn = jest.fn().mockRejectedValue(error);
    const next = jest.fn();

    await asyncHandler(fn)({}, {}, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});