import jwt from 'jsonwebtoken';
import { Doctor } from '../models/Doctor.js';
import { Paciente } from '../models/Paciente.js';
import bcrypt from 'bcryptjs';

// Registrar doctor
export const registerDoctor = async (req, res, next) => {
  try {
    const { cedula, nombre_completo, correo, contrasena } = req.body;

    // Validar campos requeridos
    if (!cedula || !nombre_completo || !correo || !contrasena) {
      return res.status(400).json({
        success: false,
        error: 'Todos los campos son requeridos'
      });
    }

    // Validaciones de formato
    if (!/^\d{10}$/.test(cedula)) {
      return res.status(400).json({
        success: false,
        error: 'La cédula debe tener 10 dígitos numéricos'
      });
    }

    if (/\d/.test(nombre_completo)) {
      return res.status(400).json({
        success: false,
        error: 'El nombre no puede contener números'
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      return res.status(400).json({
        success: false,
        error: 'El correo electrónico no es válido'
      });
    }

    // Validar si doctor existe (por cédula o correo)
    const doctorExists = await Doctor.findOne({
      $or: [{ cedula }, { correo }]
    });
    if (doctorExists) {
      return res.status(400).json({
        success: false,
        error: 'El doctor ya está registrado'
      });
    }

    // Hash contraseña
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(contrasena, salt);

    // Crear doctor
    const doctor = await Doctor.create({
      cedula,
      nombre_completo,
      correo,
      contrasena_hash: hashedPassword,
      rol: 'doctor'
    });

    // Generar JWT con más datos
    const token = generateDoctorToken(doctor);

    res.status(201).json({
      success: true,
      user: {
        id: doctor._id,
        nombre: doctor.nombre_completo,
        correo: doctor.correo,
        rol: doctor.rol
      },
      token,
      redirectTo: '/login' // Redirige al login después de registro
    });
  } catch (error) {
    next(error);
  }
};

// Login doctor
export const loginDoctor = async (req, res, next) => {
  try {
    const { correo, contrasena } = req.body;

    // Validar campos
    if (!correo || !contrasena) {
      return res.status(400).json({
        success: false,
        error: 'Correo y contraseña son requeridos'
      });
    }

    // Buscar doctor incluyendo la contraseña hash
    const doctor = await Doctor.findOne({ correo }).select('+contrasena_hash');
    if (!doctor) {
      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas'
      });
    }

    // Verificar contraseña
    const isMatch = await bcrypt.compare(contrasena, doctor.contrasena_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas'
      });
    }

    // Verificar si el usuario está activo
    if (doctor.estado === 'inactivo') {
      return res.status(403).json({
        success: false,
        error: 'Su cuenta ha sido desactivada. Contacte al administrador.'
      });
    }

    // Generar JWT
    const token = generateDoctorToken(doctor);

    // Determinar redirección según el rol
    const redirectTo = doctor.rol === 'admin' ? '/admin/dashboard' : '/dashboard';

    res.json({
      success: true,
      user: {
        id: doctor._id,
        nombre: doctor.nombre_completo,
        correo: doctor.correo,
        rol: doctor.rol,
        permisos: doctor.permisos
      },
      token,
      redirectTo
    });
  } catch (error) {
    next(error);
  }
};

// Generar token JWT mejorado
const generateDoctorToken = (doctor) => {
  return jwt.sign(
    {
      id: doctor._id,
      nombre: doctor.nombre_completo,
      rol: doctor.rol,
      cedula: doctor.cedula
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '1d'
    }
  );
};

// Login de paciente
export const loginPaciente = async (req, res, next) => {
  try {
    const { cedula, contrasena } = req.body;

    if (!cedula || !contrasena) {
      return res.status(400).json({ success: false, error: 'Cédula y contraseña son requeridos' });
    }

    const paciente = await Paciente.findOne({ cedula }).select('+contrasena_hash');
    if (!paciente) {
      return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
    }

    // Bloquear ingreso si el paciente está inactivo
    if (paciente.estado === 'inactivo') {
      return res.status(403).json({
        success: false,
        error: 'Su cuenta ha sido desactivada. Contacte al doctor o al administrador.'
      });
    }

    const isMatch = await bcrypt.compare(contrasena, paciente.contrasena_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
    }

    const token = generatePacienteToken(paciente);

    res.json({
      success: true,
      user: {
        id: paciente._id,
        nombre: paciente.nombre_completo,
        cedula: paciente.cedula,
        rol: 'paciente'
      },
      token,
      redirectTo: '/mobile/home'
    });
  } catch (error) {
    next(error);
  }
};

const generatePacienteToken = (paciente) => {
  return jwt.sign(
    {
      id: paciente._id,
      nombre: paciente.nombre_completo,
      rol: 'paciente',
      cedula: paciente.cedula
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '1d'
    }
  );
};

// Handler sencillo para verificar token desde apps móviles
export const checkToken = async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    if (!token) return res.status(401).json({ isAuthenticated: false });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return res.json({ isAuthenticated: true, user: decoded });
  } catch (e) {
    return res.status(401).json({ isAuthenticated: false });
  }
};