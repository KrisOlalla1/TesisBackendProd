import express from 'express';
import { verifyToken, verifyAdmin } from '../middlewares/auth.js';
import {
  getAllDoctores,
  createDoctor,
  updateDoctor,
  toggleEstadoDoctor,
  deleteDoctor,
  updatePermisos,
  getPacientesByDoctor,
  getAllAdmins,
  createAdmin,
  updateAdmin,
  toggleEstadoAdmin,
  deleteAdmin
} from '../controllers/adminController.js';

const router = express.Router();

// Todas las rutas requieren autenticación y rol de admin
router.use(verifyToken, verifyAdmin);

// CRUD de doctores
router.get('/doctores', getAllDoctores);
router.post('/doctores', createDoctor);
router.put('/doctores/:id', updateDoctor);
router.patch('/doctores/:id/estado', toggleEstadoDoctor);
router.delete('/doctores/:id', deleteDoctor);

// Gestión de permisos
router.patch('/doctores/:id/permisos', updatePermisos);

// Ver pacientes de un doctor
router.get('/doctores/:doctorId/pacientes', getPacientesByDoctor);

// --- RUTAS DE ADMINISTRADORES ---
router.get('/admins', getAllAdmins);
router.post('/admins', createAdmin);
router.put('/admins/:id', updateAdmin);
router.patch('/admins/:id/estado', toggleEstadoAdmin);
router.delete('/admins/:id', deleteAdmin);

export default router;
