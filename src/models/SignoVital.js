import mongoose from 'mongoose';

const SignoVitalSchema = new mongoose.Schema({
  paciente: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Paciente',
    required: true
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true
  },
  tipo: {
    type: String,
    enum: [
      'presion_arterial',
      'frecuencia_cardiaca',
      'frecuencia_respiratoria',
      'temperatura',
      'saturacion_oxigeno',
      'peso',
      'glucosa'
    ],
    required: true
  },
  valor: {
    type: String,
    required: true
  },
  fecha_registro: {
    type: Date,
    default: Date.now
  },
  notas: {
    type: String
  }
});

// Índices para mejorar consultas por paciente/fecha
SignoVitalSchema.index({ paciente: 1, fecha_registro: -1 });

export const SignoVital = mongoose.model('SignoVital', SignoVitalSchema);