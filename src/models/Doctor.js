import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const doctorSchema = new mongoose.Schema({
  cedula: { 
    type: String, 
    required: true, 
    unique: true 
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
    required: true, 
    select: false 
  },
  rol: { 
    type: String, 
    enum: ['doctor', 'admin'],
    default: 'doctor' 
  },
  estado: {
    type: String,
    enum: ['activo', 'inactivo'],
    default: 'activo'
  },
  permisos: {
    puede_editar_pacientes: {
      type: Boolean,
      default: true
    },
    puede_eliminar_pacientes: {
      type: Boolean,
      default: true
    }
  },
  fecha_registro: { 
    type: Date, 
    default: Date.now 
  }
});

// Método para hashear la contraseña
doctorSchema.pre('save', async function(next) {
  if (!this.isModified('contrasena_hash')) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.contrasena_hash = await bcrypt.hash(this.contrasena_hash, salt);
  next();
});

// Método para comparar contraseñas
doctorSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.contrasena_hash);
};

// Exportación nombrada
export const Doctor = mongoose.model('Doctor', doctorSchema);