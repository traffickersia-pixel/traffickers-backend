import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { google } from 'googleapis';
import { fileURLToPath } from 'url';
import path from 'path';
import { fetchProjectsFromSheet, fetchTasksFromSheet, fetchActivitiesFromSheet } from './googleSheets.js';

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

// Inicializar datos desde Google Sheets
async function initializeData() {
  try {
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

    console.log('📊 Cargando datos de Google Sheets...');

    // Cargar proyectos desde Google Sheets
    projects = await fetchProjectsFromSheet();
    console.log(`✅ ${projects.length} proyectos cargados`);

    // Cargar tareas desde Google Sheets
    tasks = await fetchTasksFromSheet();
    console.log(`✅ ${tasks.length} tareas cargadas`);

    console.log('🎉 Datos cargados exitosamente desde Google Sheets');
  } catch (error) {
    console.error('❌ Error al cargar datos de Google Sheets:', error.message);
    console.error('Stack:', error.stack);
    console.log('⚠️ USANDO DATOS DE DEMOSTRACIÓN COMO FALLBACK');
    console.log('⚠️ Verifica que GOOGLE_SHEET_ID y GOOGLE_API_KEY estén correctamente configurados');

    // Fallback a datos de demostración si Google Sheets falla
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
      }
    ];
  }
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
async function startServer() {
  await initializeData();
  app.listen(PORT, () => {
    console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
  });
}

startServer().catch(error => {
  console.error('Error al iniciar servidor:', error);
  process.exit(1);
});
