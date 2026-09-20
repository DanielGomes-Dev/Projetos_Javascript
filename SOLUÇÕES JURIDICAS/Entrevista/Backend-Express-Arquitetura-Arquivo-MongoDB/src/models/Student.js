const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  nome: { type: String, required: true, trim: true },
  cpf: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, trim: true, unique: true },
  dataNascimento: { type: Date, required: true },
  rendaFamiliar: { type: Number, required: true, min: 0 }
}, { timestamps: true });

studentSchema.statics.findByCpf = function findByCpf(cpf) {
  return this.findOne({ cpf });
};

studentSchema.statics.findByEmail = function findByEmail(email) {
  return this.findOne({ email });
};

module.exports = mongoose.models.Student || mongoose.model('Student', studentSchema);
