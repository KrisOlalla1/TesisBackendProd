import { Router } from 'express';
import { authMiddleware, requireDoctor, requirePaciente } from '../middlewares/auth.js';
import { registrarSignosVitales, obtenerSignosPorPaciente, crearSignosPacienteAutogestion, listarMisSignos } from '../controllers/signoVitalController.js';

const router = Router();

// Rutas para pacientes (app móvil) - DEBEN IR PRIMERO
router.post('/me', authMiddleware, requirePaciente, crearSignosPacienteAutogestion);
router.get('/me', authMiddleware, requirePaciente, listarMisSignos);

// Rutas para doctores - VAN DESPUÉS
router.post('/', authMiddleware, requireDoctor, registrarSignosVitales);
router.get('/:pacienteId', authMiddleware, requireDoctor, obtenerSignosPorPaciente);

export const signoVitalRoutes = router;