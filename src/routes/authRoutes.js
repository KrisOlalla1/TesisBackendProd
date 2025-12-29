import { Router } from 'express';
import { loginDoctor, loginPaciente, checkToken } from '../controllers/authController.js';

const router = Router();

router.post('/login', loginDoctor);
router.post('/login-paciente', loginPaciente);
router.get('/check-token', checkToken);

export const authRoutes = router;