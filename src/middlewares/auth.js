import jwt from 'jsonwebtoken';
import { Doctor } from '../models/Doctor.js';
import { Paciente } from '../models/Paciente.js';

// Middleware de autenticación que soporta Doctor, Paciente y Admin
export const authMiddleware = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Acceso no autorizado. No se proporcionó token.'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    let userDoc = null;
    if (decoded.rol === 'doctor' || decoded.rol === 'admin') {
      userDoc = await Doctor.findById(decoded.id).select('-contrasena_hash');
    } else if (decoded.rol === 'paciente') {
      userDoc = await Paciente.findById(decoded.id).select('-contrasena_hash');
    }

    if (!userDoc) {
      return res.status(401).json({ success: false, error: 'Usuario no encontrado o rol inválido' });
    }

    // Normalizar req.user para todos los roles
    req.user = {
      id: userDoc._id,
      role: decoded.rol,
      nombre: userDoc.nombre_completo,
      cedula: userDoc.cedula,
      permisos: userDoc.permisos || null
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Token inválido o expirado'
    });
  }
};

// Alias para compatibilidad
export const verifyToken = authMiddleware;

// Guards de autorización por rol
export const requireDoctor = (req, res, next) => {
  if (req.user?.role !== 'doctor') {
    return res.status(403).json({ success: false, error: 'Requiere rol doctor' });
  }
  next();
};

export const requirePaciente = (req, res, next) => {
  if (req.user?.role !== 'paciente') {
    return res.status(403).json({ success: false, error: 'Requiere rol paciente' });
  }
  next();
};

export const verifyAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Requiere rol administrador' });
  }
  next();
};