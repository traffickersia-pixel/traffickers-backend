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

export async function fetchProjectsFromSheet() {
  try {
    console.log('📊 Leyendo PROYECTOS...');
    const proyectosRows = await getSheetData('PROYECTOS', 'A:S');

    if (proyectosRows.length < 2) {
      console.warn('⚠️ No hay datos en PROYECTOS');
      return [];
    }

    const aliadosUnicos = new Set();
    proyectosRows.slice(1).forEach((row) => {
      if (row[2]) aliadosUnicos.add(row[2]);
    });

    console.log(`✅ Encontrados ${aliadosUnicos.size} aliados: ${Array.from(aliadosUnicos).join(', ')}`);

    const projects = [];
    let projectId = 1;

    for (const aliado of aliadosUnicos) {
      try {
        const sheetName = `${aliado} - operativo`;
        console.log(`  📖 Leyendo ${sheetName}...`);
        const operativoData = await getSheetData(sheetName, 'A:Z');

        if (operativoData.length > 0) {
          // Helper para buscar etiquetas (case-insensitive, trim)
          const findValue = (keyword, colB = 1) => {
            const row = operativoData.find(r =>
              r[0]?.toLowerCase().trim().includes(keyword.toLowerCase())
            );
            return row?.[colB] || '';
          };

          // Buscar datos en columnas A:B
          const web = findValue('página web', 1);
          const celular = findValue('celular', 1);
          const correo = findValue('correo', 1);
          const objective = findValue('objetivo', 1);
          const personalBrand = findValue('estrategia', 1);

          // Buscar redes en columnas E:F (column index 4:5)
          const facebook = findValue('facebook', 5);
          const instagram = findValue('instagram', 5);
          const tiktok = findValue('tiktok', 5);
          const redes = [facebook, instagram, tiktok].filter(r => r && r.trim()).join(', ');

          console.log(`    ✅ ${aliado}: Web="${web}", Tel="${celular}", Marca="${personalBrand}"`);

          projects.push({
            id: projectId,
            name: aliado,
            icon: '📋',
            userId: 1,
            aliado: { name: aliado, web, celular, redes },
            buyerPersona: { profile: '', age: '', concerns: '', behavior: '' },
            strategy: { personalBrand, competition: '', objective }
          });
          projectId++;
        }
      } catch (error) {
        console.warn(`    ⚠️ Error cargando ${aliado}:`, error.message);
      }
    }

    console.log(`✅ ${projects.length} proyectos listos`);
    return projects;
  } catch (error) {
    console.error('❌ Error en fetchProjectsFromSheet:', error.message);
    return [];
  }
}

export async function fetchTasksFromSheet() {
  try {
    console.log('📊 Leyendo tareas de PROYECTOS...');
    const proyectosRows = await getSheetData('PROYECTOS', 'A:S');

    console.log(`📋 Total filas leídas: ${proyectosRows.length}`);
    if (proyectosRows.length > 0) {
      console.log(`📌 Encabezados (fila 0): ${JSON.stringify(proyectosRows[0])}`);
    }

    if (proyectosRows.length < 2) {
      console.warn('⚠️ No hay tareas en PROYECTOS');
      return [];
    }

    const tasks = [];
    let taskId = 1;

    proyectosRows.slice(1).forEach((row, idx) => {
      const designer = row[1]?.toLowerCase().trim() || '';
      console.log(`  [Fila ${idx + 2}] Diseñador: "${designer}", Descripción: "${row[3] || ''}", Aliado: "${row[2] || ''}"`);

      if (designer.includes('aylin')) {
        const progressStr = (row[16] || '0').toString().replace('%', '').trim();
        const progress = parseInt(progressStr) || 0;

        tasks.push({
          id: taskId,
          projectId: 1,
          description: row[3] || '',
          progress: progress,
          onTime: !row[9]?.toLowerCase().includes('atrasado'),
          hours: 8,
          dueDate: formatDate(row[11])
        });
        console.log(`    ✅ Tarea agregada: "${row[3] || 'Sin descripción'}"`);
        taskId++;
      }
    });

    console.log(`✅ ${tasks.length} tareas para Aylin`);
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
