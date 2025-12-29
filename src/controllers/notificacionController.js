import { Notificacion, Paciente } from '../models/index.js';

// Crear una nueva notificación/cita
const crearNotificacion = async (req, res) => {
  try {
    const { paciente_id, titulo, mensaje, fecha_cita, tipo = 'cita' } = req.body;
    const doctor_id = req.user.id;

    // Verificar que el paciente existe
    const paciente = await Paciente.findById(paciente_id);
    if (!paciente) {
      return res.status(404).json({
        success: false,
        message: 'Paciente no encontrado'
      });
    }

    // Crear la notificación
    const nuevaNotificacion = new Notificacion({
      paciente_id,
      doctor_id,
      tipo,
      titulo,
      mensaje,
      fecha_cita: new Date(fecha_cita)
    });

    const notificacionGuardada = await nuevaNotificacion.save();

    // Poblar los datos del paciente y doctor
    await notificacionGuardada.populate('paciente_id', 'nombre_completo cedula correo');
    await notificacionGuardada.populate('doctor_id', 'nombre_completo especialidad');

    res.status(201).json({
      success: true,
      message: 'Cita agendada exitosamente',
      data: notificacionGuardada
    });

  } catch (error) {
    console.error('Error al crear notificación:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Obtener todas las notificaciones de un doctor
const obtenerNotificacionesDoctor = async (req, res) => {
  try {
    const doctor_id = req.user.id;
    const { tipo, estado, fecha_inicio, fecha_fin } = req.query;

    // Construir filtros
    const filtros = { doctor_id };
    
    if (tipo) filtros.tipo = tipo;
    if (estado) filtros.estado = estado;
    
    if (fecha_inicio && fecha_fin) {
      filtros.fecha_cita = {
        $gte: new Date(fecha_inicio),
        $lte: new Date(fecha_fin)
      };
    }

    const notificaciones = await Notificacion
      .find(filtros)
      .populate('paciente_id', 'nombre_completo cedula correo telefono')
      .populate('doctor_id', 'nombre_completo especialidad')
      .sort({ fecha_cita: 1 });

    res.json({
      success: true,
      data: notificaciones
    });

  } catch (error) {
    console.error('Error al obtener notificaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Obtener notificaciones de un paciente específico
const obtenerNotificacionesPaciente = async (req, res) => {
  try {
    const { paciente_id } = req.params;
    const doctor_id = req.user.id;

    // Buscar notificaciones del paciente
    // Por ahora, mostrar todas las notificaciones del paciente sin filtrar por doctor
    // para que se muestren las citas independientemente de qué doctor las creó
    const notificaciones = await Notificacion
      .find({ paciente_id })
      .populate('paciente_id', 'nombre_completo cedula correo')
      .populate('doctor_id', 'nombre_completo especialidad')
      .sort({ fecha_cita: -1 });

    res.json({
      success: true,
      data: notificaciones
    });

  } catch (error) {
    console.error('Error al obtener notificaciones del paciente:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Actualizar estado de una notificación
const actualizarNotificacion = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, titulo, mensaje, fecha_cita } = req.body;
    const doctor_id = req.user.id;

    const notificacion = await Notificacion.findOne({ _id: id, doctor_id });
    
    if (!notificacion) {
      return res.status(404).json({
        success: false,
        message: 'Notificación no encontrada'
      });
    }

    // Actualizar campos
    if (estado) notificacion.estado = estado;
    if (titulo) notificacion.titulo = titulo;
    if (mensaje) notificacion.mensaje = mensaje;
    if (fecha_cita) notificacion.fecha_cita = new Date(fecha_cita);

    const notificacionActualizada = await notificacion.save();
    await notificacionActualizada.populate('paciente_id', 'nombre_completo cedula correo');

    res.json({
      success: true,
      message: 'Notificación actualizada exitosamente',
      data: notificacionActualizada
    });

  } catch (error) {
    console.error('Error al actualizar notificación:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Eliminar una notificación
const eliminarNotificacion = async (req, res) => {
  try {
    const { id } = req.params;
    const doctor_id = req.user.id;

    const notificacion = await Notificacion.findOneAndDelete({ _id: id, doctor_id });
    
    if (!notificacion) {
      return res.status(404).json({
        success: false,
        message: 'Notificación no encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Notificación eliminada exitosamente'
    });

  } catch (error) {
    console.error('Error al eliminar notificación:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Obtener citas del día actual
const obtenerCitasHoy = async (req, res) => {
  try {
    const doctor_id = req.user.id;
    const hoy = new Date();
    const inicioDelDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const finDelDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59);

    const citasHoy = await Notificacion
      .find({
        doctor_id,
        tipo: 'cita',
        fecha_cita: { $gte: inicioDelDia, $lte: finDelDia }
      })
      .populate('paciente_id', 'nombre_completo cedula telefono')
      .sort({ fecha_cita: 1 });

    res.json({
      success: true,
      data: citasHoy
    });

  } catch (error) {
    console.error('Error al obtener citas de hoy:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Obtener notificaciones de un paciente específico (cross-doctor)
const obtenerNotificacionesPacienteCrossDoctor = async (req, res) => {
  try {
    const { paciente_id } = req.params;

    const notificaciones = await Notificacion
      .find({ 
        paciente_id,
        fecha_cita: { $gte: new Date() } // Solo citas futuras
      })
      .populate('paciente_id', 'nombre_completo cedula correo')
      .populate('doctor_id', 'nombre_completo especialidad')
      .sort({ fecha_cita: 1 });

    res.json({
      success: true,
      data: notificaciones
    });

  } catch (error) {
    console.error('Error al obtener notificaciones del paciente (cross-doctor):', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Obtener todas las notificaciones de un paciente específico por cédula (cross-doctor)
const obtenerNotificacionesPorCedula = async (req, res) => {
  try {
    const { cedula } = req.params;

    // Buscar el paciente por cédula
    const paciente = await Paciente.findOne({ cedula });
    if (!paciente) {
      return res.status(404).json({
        success: false,
        message: 'Paciente no encontrado'
      });
    }

    const notificaciones = await Notificacion
      .find({ 
        paciente_id: paciente._id,
        fecha_cita: { $gte: new Date() } // Solo citas futuras
      })
      .populate('paciente_id', 'nombre_completo cedula correo')
      .populate('doctor_id', 'nombre_completo especialidad')
      .sort({ fecha_cita: 1 });

    res.json({
      success: true,
      data: notificaciones,
      paciente: {
        _id: paciente._id,
        nombre_completo: paciente.nombre_completo,
        cedula: paciente.cedula,
        correo: paciente.correo
      }
    });

  } catch (error) {
    console.error('Error al obtener notificaciones por cédula:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

export {
  crearNotificacion,
  obtenerNotificacionesDoctor,
  obtenerNotificacionesPaciente,
  actualizarNotificacion,
  eliminarNotificacion,
  obtenerCitasHoy,
  obtenerNotificacionesPacienteCrossDoctor,
  obtenerNotificacionesPorCedula
};
