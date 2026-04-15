import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { google } from 'googleapis';
import { fileURLToPath } from 'url';
import path from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Variables globales
let users = [];
let projects = [];
let tasks = [];

// Inicializar datos de demostración
function initializeData() {
  const hashedPassword = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10);
  users = [
    {
      id: 1,
      name: 'Ailín',
      email: process.env.ADMIN_EMAIL,
      password: hashedPassword,
      role: 'admin'
    }
  ];

  projects = [
    {
      id: 1,
      name: 'Fumigaciones',
      icon: '🔬',
      userId: 1,
      aliado: {
        name: 'Fumigaciones Profesionales',
        web: 'https://fumigacionespro.com',
        celular: '+57 300 123 4567',
        redes: '@fumigacionespro'
      },
      buyerPersona: {
        profile: 'Propietarios de negocios y comercios',
        age: '35-55 años',
        concerns: 'Plagas, higiene, cumplimiento normativo',
        behavior: 'Buscan soluciones rápidas y confiables'
      },
      strategy: {
        personalBrand: 'Especialista en control de plagas',
        competition: 'Empresas locales de fumigación',
        objective: 'Aumentar clientes en un 40%'
      }
    },
    {
      id: 2,
      name: 'OAC',
      icon: '📋',
      userId: 1,
      aliado: {
        name: 'OAC Solutions',
        web: 'https://oac-solutions.com',
        celular: '+57 301 987 6543',
        redes: '@oac_solutions'
      },
      buyerPersona: {
        profile: 'Empresas medianas y grandes',
        age: 'Cualquier edad',
        concerns: 'Eficiencia, cumplimiento, costos',
        behavior: 'Analíticos, requieren reportes detallados'
      },
      strategy: {
        personalBrand: 'Consultor en procesos',
        competition: 'Consultoras internacionales',
        objective: 'Posicionar como experto local'
      }
    },
    {
      id: 3,
      name: 'Equilibrium',
      icon: '⚖️',
      userId: 1,
      aliado: {
        name: 'Equilibrium Consultoría',
        web: 'https://equilibrium-co.com',
        celular: '+57 302 456 7890',
        redes: '@equilibrium_co'
      },
      buyerPersona: {
        profile: 'Ejecutivos y gerentes',
        age: '40-60 años',
        concerns: 'Balance, bienestar, rentabilidad',
        behavior: 'Buscan asesoramiento premium'
      },
      strategy: {
        personalBrand: 'Coach empresarial especializado',
        competition: 'Coaches internacionales',
        objective: 'Crear membership de alto valor'
      }
    }
  ];

  tasks = [
    {
      id: 1,
      projectId: 1,
      description: 'Crear contenido para redes sociales',
      progress: 65,
      onTime: true,
      hours: 8,
      dueDate: '2026-04-20'
    },
    {
      id: 2,
      projectId: 1,
      description: 'Diseñar landing page',
      progress: 45,
      onTime: false,
      hours: 12,
      dueDate: '2026-04-18'
    },
    {
      id: 3,
      projectId: 2,
      description: 'Análisis de mercado',
      progress: 80,
      onTime: true,
      hours: 10,
      dueDate: '2026-04-22'
    },
    {
      id: 4,
      projectId: 3,
      description: 'Preparar propuesta comercial',
      progress: 30,
      onTime: false,
      hours: 15,
      dueDate: '2026-04-17'
    }
  ];
}

// Rutas de Autenticación
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' });
  }

  const user = users.find(u => u.email === email);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email
    }
  });
});

// Middleware de autenticación
function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

// Rutas protegidas
app.get('/api/user/profile', authenticate, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  res.json({
    id: user.id,
    name: user.name,
    email: user.email
  });
});

app.get('/api/projects', authenticate, (req, res) => {
  const userProjects = projects.filter(p => p.userId === req.user.id);
  res.json(userProjects);
});

app.get('/api/projects/:projectId', authenticate, (req, res) => {
  const project = projects.find(p => p.id === parseInt(req.params.projectId));
  if (!project) {
    return res.status(404).json({ error: 'Proyecto no encontrado' });
  }
  res.json(project);
});

app.get('/api/tasks', authenticate, (req, res) => {
  const projectId = req.query.projectId;
  let userTasks = tasks.filter(t => t.projectId === parseInt(projectId || 0));

  if (!projectId) {
    userTasks = tasks;
  }

  res.json(userTasks);
});

app.get('/api/unassigned-activities', authenticate, (req, res) => {
  const activities = [
    { id: 1, title: 'Crear estrategia para Instagram', project: 'Fumigaciones', hours: 5 },
    { id: 2, title: 'Escribir artículo de blog', project: 'OAC', hours: 3 },
    { id: 3, title: 'Diseñar infografía', project: 'Equilibrium', hours: 4 },
    { id: 4, title: 'Grabar video testimonial', project: 'Fumigaciones', hours: 6 }
  ];
  res.json(activities);
});

app.post('/api/activities/accept', authenticate, (req, res) => {
  const { activityId } = req.body;
  res.json({ message: 'Actividad aceptada', activityId });
});

app.get('/api/deadlines', authenticate, (req, res) => {
  const deadlines = tasks.map(task => ({
    id: task.id,
    title: task.description,
    date: task.dueDate,
    projectId: task.projectId
  }));
  res.json(deadlines);
});

app.post('/api/tasks/:taskId/update', authenticate, (req, res) => {
  const { progress } = req.body;
  const task = tasks.find(t => t.id === parseInt(req.params.taskId));
  if (task) {
    task.progress = progress;
  }
  res.json(task);
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Iniciar servidor
initializeData();
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
});
