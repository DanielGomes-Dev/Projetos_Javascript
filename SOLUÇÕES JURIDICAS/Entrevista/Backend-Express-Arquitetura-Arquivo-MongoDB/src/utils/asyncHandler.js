// Evita repetir try/catch em cada controller: encaminha qualquer rejeição
// da função assíncrona para o middleware global de erros (next(err)).
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = asyncHandler;
