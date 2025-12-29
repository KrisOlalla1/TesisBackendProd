import mongoose from 'mongoose';
import { validarCedulaEcuatoriana } from '../utils/validationUtils.js';

const pacienteSchema = new mongoose.Schema({
  cedula: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: validarCedulaEcuatoriana,
      message: 'La cédula ingresada no es válida (Ecuador)'
    }
  },
  nombre_completo: {
    type: String,
    required: true
  },
  correo: {
    type: String,
    required: true,
    unique: true
  },
  contrasena_hash: {
    type: String,
    required: true
  },
  doctor_asignado: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true
  },
  signos_habilitados: [{
    type: String,
    enum: [
      'presion_arterial',
      'frecuencia_cardiaca',
      'frecuencia_respiratoria',
      'temperatura',
      'saturacion_oxigeno',
      'peso',
      'glucosa'
    ]
  }],
  fecha_registro: {
    type: Date,
    default: Date.now
  },
  fecha_nacimiento: {
    type: Date,
    required: true
  },
  sexo: {
    type: String,
    required: true
  },
  parametros_monitor: {
    type: Array,
    default: []
  },
  estado: {
    type: String,
    enum: ['activo', 'inactivo'],
    default: 'activo'
  }
});

// Exportación nombrada
export const Paciente = mongoose.model('Paciente', pacienteSchema);