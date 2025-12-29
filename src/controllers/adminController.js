import { Doctor } from '../models/Doctor.js';
import { Paciente } from '../models/Paciente.js';
import bcrypt from 'bcryptjs';

// Obtener todos los doctores
export const getAllDoctores = async (req, res) => {
  try {
    const doctores = await Doctor.find({ rol: 'doctor' }).select('-contrasena_hash');
    res.json({
      success: true,
      data: doctores
    });
  } catch (error) {
    console.error('Error al obtener doctores:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener doctores'
    });
  }
};

// Crear un nuevo doctor
export const createDoctor = async (req, res) => {
  try {
    const { cedula, nombre_completo, correo, contrasena } = req.body;

    // Validaciones
    if (!/^\d{10}$/.test(cedula)) {
      return res.status(400).json({
        success: false,
        message: 'La cédula debe tener 10 dígitos numéricos'
      });
    }

    if (/\d/.test(nombre_completo)) {
      return res.status(400).json({
        success: false,
        message: 'El nombre no puede contener números'
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      return res.status(400).json({
        success: false,
        message: 'El correo electrónico no es válido'
      });
    }

    // Validar que no exista el correo o cédula (Solo en colección de Doctores/Admins)
    const existeDoctor = await Doctor.findOne({ $or: [{ correo }, { cedula }] });
    if (existeDoctor) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un doctor/admin con ese correo o cédula'
      });
    }

    const nuevoDoctor = new Doctor({
      cedula,
      nombre_completo,
      correo,
      contrasena_hash: contrasena,
      rol: 'doctor',
      estado: 'activo',
      permisos: {
        puede_editar_pacientes: true,
        puede_eliminar_pacientes: true
      }
    });

    await nuevoDoctor.save();

    const doctorSinPassword = await Doctor.findById(nuevoDoctor._id).select('-contrasena_hash');

    res.status(201).json({
      success: true,
      message: 'Doctor creado exitosamente',
      data: doctorSinPassword
    });
  } catch (error) {
    console.error('Error al crear doctor:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear doctor'
    });
  }
};

// Actualizar doctor
export const updateDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre_completo, correo, cedula, contrasena } = req.body;

    // Validaciones
    if (cedula && !/^\d{10}$/.test(cedula)) {
      return res.status(400).json({
        success: false,
        message: 'La cédula debe tener 10 dígitos numéricos'
      });
    }

    if (nombre_completo && /\d/.test(nombre_completo)) {
      return res.status(400).json({
        success: false,
        message: 'El nombre no puede contener números'
      });
    }

    if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      return res.status(400).json({
        success: false,
        message: 'El correo electrónico no es válido'
      });
    }

    const updateData = {};
    if (nombre_completo) updateData.nombre_completo = nombre_completo;
    if (correo) updateData.correo = correo;
    if (cedula) updateData.cedula = cedula;

    if (contrasena) {
      const salt = await bcrypt.genSalt(10);
      updateData.contrasena_hash = await bcrypt.hash(contrasena, salt);
    }

    const doctorActualizado = await Doctor.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).select('-contrasena_hash');

    if (!doctorActualizado) {
      return res.status(404).json({
        success: false,
        message: 'Doctor no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Doctor actualizado exitosamente',
      data: doctorActualizado
    });
  } catch (error) {
    console.error('Error al actualizar doctor:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar doctor'
    });
  }
};

// Cambiar estado del doctor (activo/inactivo)
export const toggleEstadoDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!['activo', 'inactivo'].includes(estado)) {
      return res.status(400).json({
        success: false,
        message: 'Estado inválido'
      });
    }

    const doctor = await Doctor.findByIdAndUpdate(
      id,
      { estado },
      { new: true }
    ).select('-contrasena_hash');

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor no encontrado'
      });
    }

    res.json({
      success: true,
      message: `Doctor ${estado === 'activo' ? 'activado' : 'desactivado'} exitosamente`,
      data: doctor
    });
  } catch (error) {
    console.error('Error al cambiar estado del doctor:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cambiar estado del doctor'
    });
  }
};

// Eliminar doctor
export const deleteDoctor = async (req, res) => {
  try {
    const { id } = req.params;

    const doctor = await Doctor.findByIdAndDelete(id);

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Doctor eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar doctor:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar doctor'
    });
  }
};

// Gestionar permisos del doctor
export const updatePermisos = async (req, res) => {
  try {
    const { id } = req.params;
    const { puede_editar_pacientes, puede_eliminar_pacientes } = req.body;

    const doctor = await Doctor.findByIdAndUpdate(
      id,
      {
        'permisos.puede_editar_pacientes': puede_editar_pacientes,
        'permisos.puede_eliminar_pacientes': puede_eliminar_pacientes
      },
      { new: true }
    ).select('-contrasena_hash');

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Permisos actualizados exitosamente',
      data: doctor
    });
  } catch (error) {
    console.error('Error al actualizar permisos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar permisos'
    });
  }
};

// Obtener pacientes de un doctor específico
export const getPacientesByDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;

    const pacientes = await Paciente.find({ doctor_asignado: doctorId });

    res.json({
      success: true,
      data: pacientes
    });
  } catch (error) {
    console.error('Error al obtener pacientes del doctor:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener pacientes del doctor'
    });
  }
};

// --- GESTIÓN DE ADMINISTRADORES ---

// Obtener todos los administradores
export const getAllAdmins = async (req, res) => {
  try {
    const admins = await Doctor.find({ rol: 'admin' }).select('-contrasena_hash');
    res.json({
      success: true,
      data: admins
    });
  } catch (error) {
    console.error('Error al obtener administradores:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener administradores'
    });
  }
};

// Crear un nuevo administrador
export const createAdmin = async (req, res) => {
  try {
    const { cedula, nombre_completo, correo, contrasena } = req.body;

    // Validaciones
    if (!/^\d{10}$/.test(cedula)) {
      return res.status(400).json({
        success: false,
        message: 'La cédula debe tener 10 dígitos numéricos'
      });
    }

    if (/\d/.test(nombre_completo)) {
      return res.status(400).json({
        success: false,
        message: 'El nombre no puede contener números'
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      return res.status(400).json({
        success: false,
        message: 'El correo electrónico no es válido'
      });
    }

    // Validar que no exista el correo o cédula (Solo en colección de Doctores/Admins)
    const existeAdmin = await Doctor.findOne({ $or: [{ correo }, { cedula }] });
    if (existeAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un usuario con ese correo o cédula'
      });
    }

    const nuevoAdmin = new Doctor({
      cedula,
      nombre_completo,
      correo,
      contrasena_hash: contrasena,
      rol: 'admin',
      estado: 'activo',
      permisos: {
        puede_editar_pacientes: true,
        puede_eliminar_pacientes: true
      }
    });

    // Hash password manual
    const salt = await bcrypt.genSalt(12);
    nuevoAdmin.contrasena_hash = await bcrypt.hash(contrasena, salt);

    await nuevoAdmin.save();

    const adminSinPassword = await Doctor.findById(nuevoAdmin._id).select('-contrasena_hash');

    res.status(201).json({
      success: true,
      message: 'Administrador creado exitosamente',
      data: adminSinPassword
    });
  } catch (error) {
    console.error('Error al crear administrador:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear administrador'
    });
  }
};

// Actualizar administrador
export const updateAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre_completo, correo, cedula, contrasena } = req.body;

    // Validaciones
    if (cedula && !/^\d{10}$/.test(cedula)) {
      return res.status(400).json({
        success: false,
        message: 'La cédula debe tener 10 dígitos numéricos'
      });
    }

    if (nombre_completo && /\d/.test(nombre_completo)) {
      return res.status(400).json({
        success: false,
        message: 'El nombre no puede contener números'
      });
    }

    if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      return res.status(400).json({
        success: false,
        message: 'El correo electrónico no es válido'
      });
    }

    const updateData = {};
    if (nombre_completo) updateData.nombre_completo = nombre_completo;
    if (correo) updateData.correo = correo;
    if (cedula) updateData.cedula = cedula;

    if (contrasena) {
      const salt = await bcrypt.genSalt(10);
      updateData.contrasena_hash = await bcrypt.hash(contrasena, salt);
    }

    const adminActualizado = await Doctor.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).select('-contrasena_hash');

    if (!adminActualizado) {
      return res.status(404).json({
        success: false,
        message: 'Administrador no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Administrador actualizado exitosamente',
      data: adminActualizado
    });
  } catch (error) {
    console.error('Error al actualizar administrador:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar administrador'
    });
  }
};

// Cambiar estado del administrador
export const toggleEstadoAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!['activo', 'inactivo'].includes(estado)) {
      return res.status(400).json({
        success: false,
        message: 'Estado inválido'
      });
    }

    const admin = await Doctor.findByIdAndUpdate(
      id,
      { estado },
      { new: true }
    ).select('-contrasena_hash');

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Administrador no encontrado'
      });
    }

    res.json({
      success: true,
      message: `Administrador ${estado === 'activo' ? 'activado' : 'desactivado'} exitosamente`,
      data: admin
    });
  } catch (error) {
    console.error('Error al cambiar estado del administrador:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cambiar estado del administrador'
    });
  }
};

// Eliminar administrador
export const deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    // Evitar que un admin se elimine a sí mismo (opcional pero recomendado)
    // En este caso req.user.id tiene el ID del admin logueado
    if (req.user.id === id) {
      return res.status(400).json({
        success: false,
        message: 'No puedes eliminar tu propia cuenta mientras estás logueado'
      });
    }

    const admin = await Doctor.findByIdAndDelete(id);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Administrador no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Administrador eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar administrador:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar administrador'
    });
  }
};
