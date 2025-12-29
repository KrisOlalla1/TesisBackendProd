import { Router } from 'express';
import {
  registrarPaciente,
  eliminarPaciente,
  obtenerPacientePorCedula,
  actualizarPaciente,
  obtenerMiPerfil
} from '../controllers/pacienteController.js';
import { authMiddleware, requirePaciente } from '../middlewares/auth.js';

const router = Router();

router.post('/registrar', registrarPaciente);
router.delete('/:id', eliminarPaciente);
router.get('/cedula/:cedula', obtenerPacientePorCedula);
router.put('/:id', actualizarPaciente);

// Actualizar estado del paciente (activo/inactivo)
router.patch('/:id/estado', async (req, res) => {
  try {
    const { estado } = req.body;
    if (!estado || !['activo', 'inactivo'].includes(estado)) {
      return res.status(400).json({ success: false, error: 'Estado inválido' });
    }
    
    const { Paciente } = await import('../models/Paciente.js');
    const paciente = await Paciente.findByIdAndUpdate(
      req.params.id,
      { estado },
      { new: true }
    );
    
    if (!paciente) {
      return res.status(404).json({ success: false, error: 'Paciente no encontrado' });
    }
    
    res.json({ success: true, data: paciente });
  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar estado' });
  }
});

// Perfil del paciente autenticado (app móvil)
router.get('/me', authMiddleware, requirePaciente, obtenerMiPerfil);

export const pacienteRoutes = router;
