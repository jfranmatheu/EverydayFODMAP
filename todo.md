# FODMAP Tracker - Estado del Proyecto

## Fase 1 - Setup ✅
- [x] Proyecto Expo con React Native + TypeScript
- [x] NativeWind/TailwindCSS para estilos responsive
- [x] Expo-SQLite con base de datos completa
- [x] Sistema de temas (claro/oscuro/automático)
- [x] Navegación con 5 tabs animados

## Fase 2 - Funcionalidades Principales ✅
- [x] 🏠 Inicio: Dashboard con estadísticas diarias, acciones rápidas
- [x] 🥗 Alimentos: Gestión de ingredientes y recetas con filtros FODMAP
- [x] 📝 Registro: Formularios para comidas, agua, síntomas, deposiciones, tratamientos
- [x] 📅 Calendario: Vista mensual con indicadores de actividad
- [x] ⚙️ Ajustes: Tema, notificaciones, exportar/importar datos

## Componentes UI ✅
- [x] Card - Tarjetas con animaciones de press
- [x] Button - Botones con variantes (primary, secondary, outline, ghost, danger)
- [x] FODMAPBadge - Indicadores de nivel FODMAP (bajo/medio/alto)

## Rutas Dinámicas ✅
- [x] /ingredient/[id] - Crear/editar ingredientes
- [x] /recipe/[id] - Crear/editar recetas

## Actividades/Ejercicio ✅
- [x] Registro de actividad (tipo, duración, intensidad, distancia, calorías)
- [x] Tipos de actividad predefinidos y personalizados
- [x] Recomendaciones basadas en historial (actividades frecuentes)
- [x] Actividades programadas/repetitivas:
  - [x] Frecuencias: diario, semanal, días específicos, cada X días, mensual
  - [x] Marcar como completada o saltada
  - [x] Visualización de estado (completado/saltado/pendiente)
- [x] Base de datos con tablas: activity_types, activity_logs, scheduled_activities, scheduled_activity_logs

## Calendario ✅
- [x] Vista mes con indicadores de eventos
- [x] Vista semana con navegación
- [x] Vista día con detalles completos
- [x] Selector de vistas (Mes/Semana/Día)
- [x] Navegación temporal (anterior/siguiente)
- [x] Actividades incluidas en calendario

## Próximos pasos (Fase 3)
- [ ] Gráficos de análisis y correlaciones (síntomas vs comidas/actividades)
- [ ] Export/Import JSON funcional completo
- [ ] Notificaciones y recordatorios
- [ ] Historial de cumplimiento de actividades programadas
- [ ] Detección de patrones en actividades
