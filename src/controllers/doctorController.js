import { Paciente } from '../models/Paciente.js';
import { Doctor } from '../models/Doctor.js';
import bcrypt from 'bcryptjs';

export const createPatient = async (req, res, next) => {
  try {
    const { cedula, nombre_completo, correo, contrasena, fecha_nacimiento, sexo, signos_habilitados, doctor_asignado } = req.body;

    // Validar si paciente existe
    const pacienteExists = await Paciente.findOne({ $or: [{ cedula }, { correo }] });
    if (pacienteExists) {
      return res.status(400).json({ 
        success: false,
        error: 'El paciente ya está registrado' 
      });
    }

    // Hashear la contraseña
    const contrasena_hash = await bcrypt.hash(contrasena, 10);

    // Usar doctor_asignado del body si viene (caso admin), sino usar el doctor autenticado
    const doctorId = doctor_asignado || req.user.id;

    // Crear paciente
    const paciente = new Paciente({
      cedula,
      nombre_completo,
      correo,
      contrasena_hash,
      doctor_asignado: doctorId,
      signos_habilitados,
      fecha_nacimiento,
      sexo
    });

    await paciente.save();

    // Actualizar lista de pacientes del doctor
    await Doctor.findByIdAndUpdate(
      doctorId,
      { $push: { pacientes_asignados: paciente._id } }
    );

    res.status(201).json({
      success: true,
      data: paciente
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

export const getDoctorPatients = async (req, res, next) => {
  try {
    const pacientes = await Paciente.find({ doctor_asignado: req.user.id })
      .select('-contrasena_hash');
    
    res.json({
      success: true,
      count: pacientes.length,
      data: pacientes
    });
  } catch (error) {
    next(error);
  }
};

export const registerDoctor = async (req, res, next) => {
  try {
    const { cedula, nombre_completo, correo, contrasena } = req.body;

    // Validaciones básicas
    if (!cedula || !nombre_completo || !correo || !contrasena) {
      return res.status(400).json({
        success: false,
        error: 'Faltan campos obligatorios: cédula, nombre_completo, correo, contrasena'
      });
    }

    // Verificar duplicados
    const doctorExists = await Doctor.findOne({ $or: [{ cedula }, { correo }] });
    if (doctorExists) {
      return res.status(400).json({
        success: false,
        error: 'Ya existe un doctor con esta cédula o correo'
      });
    }

    // Crear doctor sin hashear la contraseña manualmente
    // El pre-save del modelo hará el hash automáticamente
    const doctor = new Doctor({
      cedula,
      nombre_completo,
      correo,
      contrasena_hash: contrasena, // en texto plano, se hasheará en pre-save
      rol: 'doctor'
    });

    await doctor.save();

    // Respuesta sin datos sensibles
    res.status(201).json({
      success: true,
      data: {
        _id: doctor._id,
        cedula: doctor.cedula,
        nombre_completo: doctor.nombre_completo,
        correo: doctor.correo,
        rol: doctor.rol,
        fecha_registro: doctor.fecha_registro
      }
    });

  } catch (error) {
    next(error);
  }
};

export const updatePatient = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { cedula, nombre_completo, correo, contrasena, fecha_nacimiento, sexo, estado } = req.body;

    // Buscar el paciente
    const paciente = await Paciente.findById(id);
    if (!paciente) {
      return res.status(404).json({
        success: false,
        error: 'Paciente no encontrado'
      });
    }

    // Verificar que el usuario sea admin o sea el doctor asignado
    if (req.user.role !== 'admin' && paciente.doctor_asignado.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permiso para editar este paciente'
      });
    }

    // Actualizar campos
    if (cedula) paciente.cedula = cedula;
    if (nombre_completo) paciente.nombre_completo = nombre_completo;
    if (correo) paciente.correo = correo;
    if (fecha_nacimiento) paciente.fecha_nacimiento = fecha_nacimiento;
    if (sexo) paciente.sexo = sexo;
    // Permitir cambiar el estado (activo/inactivo)
    if (typeof estado === 'string') {
      const estadoNormalizado = estado.toLowerCase();
      if (['activo', 'inactivo'].includes(estadoNormalizado)) {
        paciente.estado = estadoNormalizado;
      }
    }
    
    // Si hay nueva contraseña, hashearla
    if (contrasena) {
      paciente.contrasena_hash = await bcrypt.hash(contrasena, 10);
    }

    await paciente.save();

    res.json({
      success: true,
      message: 'Paciente actualizado exitosamente',
      data: paciente
    });
  } catch (error) {
    console.error('Error al actualizar paciente:', error);
    next(error);
  }
};

export const deletePatient = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Buscar el paciente
    const paciente = await Paciente.findById(id);
    if (!paciente) {
      return res.status(404).json({
        success: false,
        error: 'Paciente no encontrado'
      });
    }

    // Verificar que el usuario sea admin o sea el doctor asignado
    if (req.user.role !== 'admin' && paciente.doctor_asignado.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permiso para eliminar este paciente'
      });
    }

    // Eliminar el paciente de la lista del doctor
    await Doctor.findByIdAndUpdate(
      paciente.doctor_asignado,
      { $pull: { pacientes_asignados: paciente._id } }
    );

    // Eliminar el paciente
    await Paciente.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Paciente eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar paciente:', error);
    next(error);
  }
};
