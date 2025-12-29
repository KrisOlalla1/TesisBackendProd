import { SignoVital } from '../models/SignoVital.js';
import { Paciente } from '../models/Paciente.js';

export const registrarSignosVitales = async (req, res) => {
  try {
    const { paciente, signos } = req.body;
    const doctor = req.user.id;

    const registros = Object.entries(signos).map(([tipo, valor]) => ({
      paciente,
      doctor,
      tipo,
      valor
    }));

    await SignoVital.insertMany(registros);

    res.status(201).json({ success: true, message: 'Signos vitales registrados correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al registrar signos vitales' });
  }
};

export const obtenerSignosPorPaciente = async (req, res) => {
  try {
    const { pacienteId } = req.params;
    const signos = await SignoVital.find({ paciente: pacienteId }).sort({ fecha_registro: -1 });
    res.json({ success: true, data: signos });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener signos vitales' });
  }
};

// Crear signos por el propio paciente (app móvil)
export const crearSignosPacienteAutogestion = async (req, res) => {
  try {
    const pacienteId = req.user.id; // viene del token con rol paciente
    const { signos } = req.body; // { tipo: valor } o array de objetos

    if (!signos || (typeof signos !== 'object')) {
      return res.status(400).json({ success: false, error: 'Debe enviar un objeto con signos {tipo: valor}' });
    }

    // Cargar paciente para validar tipos habilitados
    const paciente = await Paciente.findById(pacienteId);
    if (!paciente) {
      return res.status(404).json({ success: false, error: 'Paciente no encontrado' });
    }

    const tiposHabilitados = new Set(paciente.signos_habilitados || []);
    const registros = [];

    for (const [tipo, valor] of Object.entries(signos)) {
      if (!tiposHabilitados.has(tipo)) {
        return res.status(400).json({ success: false, error: `El signo ${tipo} no está habilitado por su doctor` });
      }
      if (valor === undefined || valor === null || valor === '') {
        return res.status(400).json({ success: false, error: `Valor inválido para ${tipo}` });
      }
      registros.push({
        paciente: pacienteId,
        doctor: paciente.doctor_asignado,
        tipo,
        valor: String(valor)
      });
    }

    const creados = await SignoVital.insertMany(registros);
    res.status(201).json({ success: true, message: 'Signos registrados', data: creados });
  } catch (error) {
    console.error('Error al registrar signos (paciente):', error);
    res.status(500).json({ success: false, error: 'Error al registrar signos vitales' });
  }
};

// Listar signos del propio paciente
export const listarMisSignos = async (req, res) => {
  try {
    const pacienteId = req.user.id;
    const signos = await SignoVital.find({ paciente: pacienteId }).sort({ fecha_registro: -1 });
    res.json({ success: true, data: signos });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error al obtener sus signos vitales' });
  }
};