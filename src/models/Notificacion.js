import mongoose from 'mongoose';

const notificacionSchema = new mongoose.Schema({
  paciente_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Paciente',
    required: true
  },
  doctor_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true
  },
  tipo: {
    type: String,
    enum: ['cita', 'recordatorio', 'resultado'],
    default: 'cita',
    required: true
  },
  titulo: {
    type: String,
    required: true
  },
  mensaje: {
    type: String,
    required: true
  },
  fecha_cita: {
    type: Date,
    required: true
  },
  estado: {
    type: String,
    enum: ['pendiente', 'confirmada', 'cancelada', 'completada'],
    default: 'pendiente'
  },
  leida: {
    type: Boolean,
    default: false
  },
  fecha_creacion: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Índices para mejorar las consultas
notificacionSchema.index({ paciente_id: 1, fecha_cita: 1 });
notificacionSchema.index({ doctor_id: 1, fecha_cita: 1 });
notificacionSchema.index({ estado: 1, fecha_cita: 1 });

export const Notificacion = mongoose.model('Notificacion', notificacionSchema);
