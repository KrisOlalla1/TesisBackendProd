import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      // Opciones recomendadas para versiones recientes:
      serverSelectionTimeoutMS: 5000,  // Timeout después de 5 segundos
      maxPoolSize: 10,  // Máximo de conexiones
    });
    console.log('✅ MongoDB conectado correctamente');
    
    // Event listeners para manejar errores post-conexión
    mongoose.connection.on('error', err => {
      console.error('❌ Error de conexión con MongoDB:', err.message);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB desconectado');
    });
    
  } catch (err) {
    console.error('❌ Error al conectar a MongoDB:', err.message);
    process.exit(1);
  }
};