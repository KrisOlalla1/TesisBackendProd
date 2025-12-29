import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import { doctorRoutes } from './routes/doctorRoutes.js';
import { pacienteRoutes } from './routes/pacienteRoutes.js';
import { authRoutes } from './routes/authRoutes.js';
import { signoVitalRoutes } from './routes/signoVitalRoutes.js';
import { notificacionRoutes } from './routes/notificacionRoutes.js';
// Importamos versión limpia del router LLM mientras se sanea el archivo original
import { llmRoutes } from './routes/llmRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

dotenv.config();
const app = express();

// Configuración CORS para permitir cualquier origen
const corsOptions = {
  origin: '*', // Permite cualquier origen
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], // ✅ Agregado PATCH
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

// Middlewares
app.use(cors(corsOptions));
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

// Conexión a la base de datos
connectDB();

// Rutas del sistema
app.use('/api/admin', adminRoutes);
app.use('/api/doctores', doctorRoutes);
app.use('/api/pacientes', pacienteRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/signos-vitales', signoVitalRoutes);
app.use('/api/notificaciones', notificacionRoutes);
app.use('/api/llm', llmRoutes);

// Ruta de prueba CORS
app.get('/api/test-cors', (req, res) => {
  res.json({ message: 'CORS configurado correctamente' });
});

// Manejo global de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Iniciar servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Backend corriendo en http://localhost:${PORT}`);
  console.log(`✅ Frontend permitido: http://localhost:3000`);
});
