import { Paciente } from '../models/Paciente.js';
import bcrypt from 'bcryptjs';

// Registrar paciente
export const registrarPaciente = async (req, res) => {
  try {
    const { cedula, nombre_completo, contrasena, fecha_nacimiento, sexo } = req.body;

    if (!cedula || !nombre_completo || !contrasena || !fecha_nacimiento || !sexo) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    const existe = await Paciente.findOne({ cedula });
    if (existe) {
      return res.status(400).json({ error: 'La cédula ya está registrada' });
    }

    const contrasena_hash = await bcrypt.hash(contrasena, 10);

    const paciente = new Paciente({
      cedula,
      nombre_completo,
      contrasena_hash,
      fecha_nacimiento,
      sexo
    });

    await paciente.save();

    res.status(201).json({ message: 'Paciente registrado correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Eliminar paciente
export const eliminarPaciente = async (req, res) => {
  try {
    const { id } = req.params;

    const paciente = await Paciente.findById(id);
    if (!paciente) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    await Paciente.findByIdAndDelete(id);
    res.json({ message: 'Paciente eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar paciente:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Obtener paciente por cédula (sin filtrar por doctor)
export const obtenerPacientePorCedula = async (req, res) => {
  try {
    const { cedula } = req.params;
    const paciente = await Paciente.findOne({ cedula });

    if (!paciente) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    res.json({ success: true, data: paciente });
  } catch (error) {
    console.error('Error al buscar paciente:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Obtener perfil del paciente autenticado (app móvil)
export const obtenerMiPerfil = async (req, res) => {
  try {
    const pacienteId = req.user.id;
    const paciente = await Paciente.findById(pacienteId).select('-contrasena_hash');
    if (!paciente) return res.status(404).json({ success: false, error: 'Paciente no encontrado' });
    res.json({ success: true, data: paciente });
  } catch (error) {
    console.error('Error al obtener mi perfil:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
};

// Actualizar paciente
export const actualizarPaciente = async (req, res) => {
  try {
    const { id } = req.params;
    const { cedula, nombre_completo, contrasena, fecha_nacimiento, sexo, signos_habilitados } = req.body;

    const paciente = await Paciente.findById(id);
    if (!paciente) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    // Validar que cedula no esté en otro paciente distinto
    if (cedula && cedula !== paciente.cedula) {
      const existeCedula = await Paciente.findOne({ cedula });
      if (existeCedula) {
        return res.status(400).json({ error: 'La cédula ya está registrada por otro paciente' });
      }
    }

    paciente.cedula = cedula || paciente.cedula;
    paciente.nombre_completo = nombre_completo || paciente.nombre_completo;
    paciente.fecha_nacimiento = fecha_nacimiento || paciente.fecha_nacimiento;
    paciente.sexo = sexo || paciente.sexo;
    if (signos_habilitados) paciente.signos_habilitados = signos_habilitados;

    if (contrasena) {
      paciente.contrasena_hash = await bcrypt.hash(contrasena, 10);
    }

    await paciente.save();

    res.json({ success: true, message: 'Paciente actualizado correctamente', data: paciente });
  } catch (error) {
    console.error('Error al actualizar paciente:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};
