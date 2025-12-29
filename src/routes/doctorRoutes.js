// doctorRoutes.js
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { 
  createPatient, 
  getDoctorPatients,
  updatePatient,
  deletePatient,
  registerDoctor
} from '../controllers/doctorController.js';

const router = Router();

// Ruta pública para registro de doctor
router.post('/register', registerDoctor);

// Middleware de autenticación para rutas protegidas
router.use(authMiddleware);

// Rutas protegidas
router.post('/pacientes', createPatient);
router.get('/pacientes', getDoctorPatients);
router.put('/pacientes/:id', updatePatient);
router.delete('/pacientes/:id', deletePatient);

export const doctorRoutes = router;