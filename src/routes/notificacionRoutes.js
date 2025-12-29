import express from 'express';
import {
  crearNotificacion,
  obtenerNotificacionesDoctor,
  obtenerNotificacionesPaciente,
  actualizarNotificacion,
  eliminarNotificacion,
  obtenerCitasHoy,
  obtenerNotificacionesPacienteCrossDoctor,
  obtenerNotificacionesPorCedula
} from '../controllers/notificacionController.js';
import { authMiddleware, requireDoctor, requirePaciente } from '../middlewares/auth.js';
import { Notificacion } from '../models/Notificacion.js';

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

// ========================================
// RUTAS ESPECÍFICAS (VAN PRIMERO)
// ========================================

// Rutas para paciente móvil
// Mis notificaciones (todas)
router.get('/me', requirePaciente, async (req, res) => {
  try {
    const notificaciones = await Notificacion.find({
      paciente_id: req.user.id
    }).populate('doctor_id', 'nombre_completo especialidad').sort({ fecha_cita: -1 });
    res.json({ success: true, data: notificaciones });
  } catch (e) {
    console.error('Error al obtener notificaciones (paciente):', e);
    res.status(500).json({ success: false, error: 'Error al obtener notificaciones' });
  }
});

// Mis próximas citas (a partir de hoy)
router.get('/me/proximas', requirePaciente, async (req, res) => {
  try {
    const citas = await Notificacion.find({
      paciente_id: req.user.id,
      tipo: 'cita',
      fecha_cita: { $gte: new Date() }
    }).populate('doctor_id', 'nombre_completo').sort({ fecha_cita: 1 });
    res.json({ success: true, data: citas });
  } catch (e) {
    console.error('Error al obtener próximas citas (paciente):', e);
    res.status(500).json({ success: false, error: 'Error al obtener próximas citas' });
  }
});

// Marcar notificación como leída (solo dueño paciente)
router.patch('/me/:id/leida', requirePaciente, async (req, res) => {
  try {
    const notif = await Notificacion.findOneAndUpdate(
      { _id: req.params.id, paciente_id: req.user.id },
      { $set: { leida: true } },
      { new: true }
    );
    if (!notif) return res.status(404).json({ success: false, error: 'Notificación no encontrada' });
    res.json({ success: true, data: notif });
  } catch (e) {
    console.error('Error al marcar leída:', e);
    res.status(500).json({ success: false, error: 'Error al actualizar notificación' });
  }
});

// Obtener citas del día actual (doctor)
router.get('/hoy', requireDoctor, obtenerCitasHoy);

// Obtener notificaciones de un paciente por cédula (cross-doctor)
router.get('/cedula/:cedula', obtenerNotificacionesPorCedula);

// Obtener notificaciones de un paciente específico (cross-doctor)
router.get('/paciente-cross/:paciente_id', obtenerNotificacionesPacienteCrossDoctor);

// ========================================
// RUTAS GENÉRICAS (VAN AL FINAL)
// ========================================

// Crear nueva notificación/cita (solo doctor)
router.post('/', requireDoctor, crearNotificacion);

// Obtener todas las notificaciones del doctor
router.get('/', requireDoctor, obtenerNotificacionesDoctor);

// Obtener notificaciones de un paciente específico (doctor)
router.get('/paciente/:paciente_id', requireDoctor, obtenerNotificacionesPaciente);

// Actualizar notificación (por ID genérico)
router.put('/:id', actualizarNotificacion);

// Eliminar notificación (por ID genérico)
router.delete('/:id', eliminarNotificacion);

export const notificacionRoutes = router;
