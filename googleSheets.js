import { google } from 'googleapis';

const sheets = google.sheets('v4');

const getAuthClient = () => {
  return google.auth.fromAPIKey(process.env.GOOGLE_API_KEY);
};

async function getSheetData(sheetName, range) {
  const auth = getAuthClient();
  const sheetId = process.env.GOOGLE_SHEET_ID;

  try {
    const response = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: sheetId,
      range: `${sheetName}!${range}`,
    });
    return response.data.values || [];
  } catch (error) {
    console.error(`❌ Error leyendo ${sheetName}: ${error.message}`);
    return [];
  }
}

// Global map to store aliado -> projectId mapping
export let aliadoProjectIdMap = {};

export async function fetchProjectsFromSheet() {
  try {
    console.log('📊 Leyendo PROYECTOS...');
    const proyectosRows = await getSheetData('PROYECTOS', 'A:S');

    if (proyectosRows.length < 2) {
      console.warn('⚠️ No hay datos en PROYECTOS');
      return [];
    }

    // Usar array en lugar de Set para mantener orden consistente
    const aliadosUnicos = [];
    const aliadosSet = new Set();
    proyectosRows.slice(1).forEach((row) => {
      const aliado = row[2]?.trim() || '';
      if (aliado && !aliadosSet.has(aliado)) {
        aliadosUnicos.push(aliado);
        aliadosSet.add(aliado);
      }
    });

    console.log(`✅ Encontrados ${aliadosUnicos.length} aliados: ${aliadosUnicos.join(', ')}`);

    const projects = [];
    let projectId = 1;

    for (const aliado of aliadosUnicos) {
      try {
        const aliadoNormalizado = aliado.trim();
        const sheetName = `${aliado} - operativo`;
        console.log(`  📖 Leyendo "${aliadoNormalizado}" - operativo... (ProjectID: ${projectId})`);
        // Guardar el mapping para usarlo en fetchTasksFromSheet (NORMALIZADO)
        aliadoProjectIdMap[aliadoNormalizado] = projectId;
        console.log(`     ✅ Mapeado: "${aliadoNormalizado}" = ProjectID ${projectId}`);

        const operativoData = await getSheetData(sheetName, 'A:Z');

        if (operativoData.length > 0) {
          // Helper para buscar etiquetas (case-insensitive, trim)
          const findValue = (keyword, colIndex = 1) => {
            const row = operativoData.find(r =>
              r[0]?.toLowerCase().trim().includes(keyword.toLowerCase())
            );
            return row?.[colIndex] || '';
          };

          // Buscar datos en columnas A:B
          const web = findValue('página web', 1);
          const celular = findValue('celular', 1);
          const correo = findValue('correo', 1);
          const objective = findValue('objetivo', 1);
          const personalBrand = findValue('estrategia', 1);

          // Debug: mostrar todas las filas para encontrar redes sociales
          console.log(`    📊 Estructura de ${sheetName}:`);
          operativoData.slice(0, 20).forEach((row, idx) => {
            if (row[0] || row[4]) {
              console.log(`      [${idx}] A="${row[0] || ''}" | E="${row[4] || ''}" | F="${row[5] || ''}"`);
            }
          });

          // Buscar redes en columnas E:F (column index 4:5) - buscar en la columna E
          const facebook = findValue('facebook', 5);
          const instagram = findValue('instagram', 5);
          const tiktok = findValue('tiktok', 5);
          const youtube = findValue('youtube', 5);
          const whatsapp = findValue('whatsapp', 5);

          const redesArray = [facebook, instagram, tiktok, youtube, whatsapp].filter(r => r && r.trim());
          const redes = redesArray.length > 0 ? redesArray.join(', ') : '';

          console.log(`    ✅ ${aliado}: Web="${web}", Tel="${celular}", Redes="${redes}", Marca="${personalBrand}"`);

          projects.push({
            id: projectId,
            name: aliado,
            icon: '📋',
            userId: 1,
            aliado: { name: aliado, web, celular, redes },
            buyerPersona: { profile: '', age: '', concerns: '', behavior: '' },
            strategy: { personalBrand, competition: '', objective }
          });
          console.log(`    ✅ Proyecto creado: ID=${projectId}, Nombre="${aliado}"`);
          projectId++;
        }
      } catch (error) {
        console.warn(`    ⚠️ Error cargando ${aliado}:`, error.message);
      }
    }

    console.log(`✅ ${projects.length} proyectos creados:`);
    projects.forEach(p => {
      console.log(`   ✓ ProjectID ${p.id}: "${p.name}"`);
    });
    console.log(`\n📌 MAPPING FINAL (Aliado -> ProjectID):`);
    Object.entries(aliadoProjectIdMap).forEach(([aliado, id]) => {
      console.log(`   "${aliado}" => ${id}`);
    });
    return projects;
  } catch (error) {
    console.error('❌ Error en fetchProjectsFromSheet:', error.message);
    return [];
  }
}

export async function fetchTasksFromSheet() {
  try {
    console.log('\n📊 LEYENDO TAREAS DE PROYECTOS...');
    console.log(`📌 MAPPING DISPONIBLE: ${JSON.stringify(aliadoProjectIdMap)}`);

    const proyectosRows = await getSheetData('PROYECTOS', 'A:S');
    console.log(`📋 Total filas en PROYECTOS: ${proyectosRows.length}`);

    if (proyectosRows.length < 2) {
      console.warn('⚠️ No hay datos en PROYECTOS');
      return [];
    }

    const tasks = [];
    let taskId = 1;

    console.log('\n📋 PROCESANDO TAREAS DE AYLIN:');
    proyectosRows.slice(1).forEach((row, rowIdx) => {
      const designer = row[1]?.toLowerCase().trim() || '';
      const aliado = row[2]?.trim() || '';
      const descripcion = row[3] || '';

      if (designer.includes('aylin')) {
        const progressStr = (row[16] || '0').toString().replace('%', '').trim();
        const progress = parseInt(progressStr) || 0;

        // Obtener el projectId correcto
        let projectId = aliadoProjectIdMap[aliado];
        if (!projectId) {
          const aliadoLower = aliado.toLowerCase();
          const foundKey = Object.keys(aliadoProjectIdMap).find(key => key.toLowerCase() === aliadoLower);
          projectId = foundKey ? aliadoProjectIdMap[foundKey] : null;
        }

        if (!projectId) {
          console.warn(`   ⚠️ NO ENCONTRADO: Aliado "${aliado}" no está en el mapping`);
          console.warn(`      Claves disponibles: ${Object.keys(aliadoProjectIdMap).join(', ')}`);
          return; // Skip this task
        }

        tasks.push({
          id: taskId,
          projectId: projectId,
          description: descripcion,
          progress: progress,
          onTime: !row[9]?.toLowerCase().includes('atrasado'),
          hours: 8,
          dueDate: formatDate(row[11])
        });

        console.log(`   ✓ TaskID ${taskId} => ProjectID ${projectId} | Aliado: "${aliado}" | "${descripcion}"`);
        taskId++;
      }
    });

    console.log(`\n✅ RESUMEN: ${tasks.length} tareas cargadas`);
    const tasksByProject = {};
    tasks.forEach(t => {
      if (!tasksByProject[t.projectId]) tasksByProject[t.projectId] = [];
      tasksByProject[t.projectId].push(t);
    });

    Object.entries(aliadoProjectIdMap).forEach(([aliado, projId]) => {
      const count = tasksByProject[projId]?.length || 0;
      console.log(`   ProjectID ${projId} (${aliado}): ${count} tareas`);
    });

    return tasks;
  } catch (error) {
    console.error('❌ Error en fetchTasksFromSheet:', error.message);
    return [];
  }
}

function formatDate(dateStr) {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  try {
    const [day, month, year] = dateStr.split('/');
    if (day && month && year) {
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  } catch (e) {}
  return new Date().toISOString().split('T')[0];
}

export async function fetchActivitiesFromSheet() {
  try {
    const proyectosRows = await getSheetData('PROYECTOS', 'A:S');
    const activities = [];
    let activityId = 1;

    proyectosRows.slice(1).forEach((row) => {
      if (row[1]?.toLowerCase().includes('aylin')) {
        activities.push({
          id: activityId,
          title: row[3] || '',
          project: row[2] || '',
          hours: 8
        });
        activityId++;
      }
    });

    console.log(`✅ ${activities.length} actividades`);
    return activities;
  } catch (error) {
    console.error('❌ Error en fetchActivitiesFromSheet:', error.message);
    return [];
  }
}
