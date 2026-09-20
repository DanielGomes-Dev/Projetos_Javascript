const mongoose = require('mongoose');

const STATUSES = ['CONFIRMADA', 'FILA_ESPERA', 'CANCELADA'];
const ACTIVE_STATUSES = ['CONFIRMADA', 'FILA_ESPERA'];

const enrollmentSchema = new mongoose.Schema({
  alunoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  cursoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  status: { type: String, enum: STATUSES, required: true },
  percentualBolsa: { type: Number, required: true, min: 0, max: 1 },
  valorFinal: { type: Number, required: true, min: 0 },
  activeKey: { type: String }
}, { timestamps: true });

enrollmentSchema.index(
  { activeKey: 1 },
  { unique: true, partialFilterExpression: { activeKey: { $exists: true } } }
);

enrollmentSchema.index({ cursoId: 1, status: 1, createdAt: 1, _id: 1 });
enrollmentSchema.index({ alunoId: 1 });

function buildActiveKey(alunoId, cursoId) {
  return `${alunoId}:${cursoId}`;
}

enrollmentSchema.statics.findActiveByAlunoAndCurso = function findActiveByAlunoAndCurso(alunoId, cursoId) {
  return this.findOne({ alunoId, cursoId, status: { $in: ACTIVE_STATUSES } });
};

enrollmentSchema.statics.findFirstWaiting = function findFirstWaiting(cursoId) {
  return this.findOne({ cursoId, status: 'FILA_ESPERA' }).sort({ createdAt: 1, _id: 1 });
};

enrollmentSchema.statics.updateStatusIfCurrent = function updateStatusIfCurrent(id, fromStatus, toStatus) {
  const update = { $set: { status: toStatus } };
  if (toStatus === 'CANCELADA') {
    update.$unset = { activeKey: '' };
  }
  return this.findOneAndUpdate({ _id: id, status: fromStatus }, update, { new: true });
};

enrollmentSchema.statics.createActive = function createActive({ alunoId, cursoId, status, percentualBolsa, valorFinal }) {
  return this.create({
    alunoId,
    cursoId,
    status,
    percentualBolsa,
    valorFinal,
    activeKey: buildActiveKey(alunoId, cursoId)
  });
};

const Enrollment = mongoose.models.Enrollment || mongoose.model('Enrollment', enrollmentSchema);
Enrollment.ACTIVE_STATUSES = ACTIVE_STATUSES;
Enrollment.STATUSES = STATUSES;

module.exports = Enrollment;
