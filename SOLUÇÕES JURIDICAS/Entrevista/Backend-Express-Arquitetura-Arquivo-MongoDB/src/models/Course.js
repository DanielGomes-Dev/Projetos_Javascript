const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  nome: { type: String, required: true, trim: true },
  codigo: { type: String, required: true, unique: true, trim: true },
  descricao: { type: String, trim: true },
  idadeMinima: { type: Number, required: true, default: 0, min: 0 },
  capacidadeVagas: { type: Number, required: true, min: 1 },
  vagasOcupadas: { type: Number, default: 0, min: 0 },
  valorMensalidade: { type: Number, required: true, min: 0 },
  status: {
    type: String,
    enum: ['ABERTO', 'ENCERRADO'],
    default: 'ABERTO'
  }
}, { timestamps: true });

courseSchema.statics.incrementIfHasCapacity = function incrementIfHasCapacity(cursoId) {
  return this.findOneAndUpdate(
    {
      _id: cursoId,
      status: 'ABERTO',
      $expr: { $lt: ['$vagasOcupadas', '$capacidadeVagas'] }
    },
    { $inc: { vagasOcupadas: 1 } },
    { new: true }
  );
};

courseSchema.statics.decrementIfPositive = function decrementIfPositive(cursoId) {
  return this.findOneAndUpdate(
    { _id: cursoId, vagasOcupadas: { $gt: 0 } },
    { $inc: { vagasOcupadas: -1 } },
    { new: true }
  );
};

module.exports = mongoose.models.Course || mongoose.model('Course', courseSchema);
