import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Doctor } from './src/models/Doctor.js';

dotenv.config();

const deleteAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado a MongoDB');

    // Eliminar el admin anterior
    const result = await Doctor.deleteOne({ correo: 'admin@iess.gob.ec' });
    console.log(`✅ Admin anterior eliminado (${result.deletedCount} documento(s))`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

deleteAdmin();
