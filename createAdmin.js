import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { Doctor } from './src/models/Doctor.js';

dotenv.config();

const createAdmin = async () => {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado a MongoDB');

    // Verificar si ya existe el admin
    const adminExiste = await Doctor.findOne({ correo: 'admin@iess.gob.ec' });
    
    if (adminExiste) {
      console.log('⚠️  El administrador ya existe en la base de datos');
      process.exit(0);
    }

    // Crear el administrador
    const admin = new Doctor({
      cedula: '0000000000',
      nombre_completo: 'Administrador IESS',
      correo: 'admin@iess.gob.ec',
      contrasena_hash: 'adminadmin2025', // El pre-save hook se encargará de hashearla
      rol: 'admin',
      estado: 'activo',
      permisos: {
        puede_editar_pacientes: true,
        puede_eliminar_pacientes: true
      }
    });

    await admin.save();

    console.log('✅ Administrador creado exitosamente:');
    console.log('   📧 Correo: admin@iess.gob.ec');
    console.log('   🔒 Contraseña: adminadmin2025');
    console.log('   👤 Rol: admin');
    console.log('\n🎉 Ya puedes iniciar sesión con estas credenciales');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error al crear administrador:', error);
    process.exit(1);
  }
};

createAdmin();
