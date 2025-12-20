Design Document
1. Project Overview

Name: Everyday FODMAP
Description: App multiplataforma (móvil Android/iOS, web, posible PC) para gestión FODMAP. Enfoque: privacidad local, datos en Expo-SQLite. Stack: Expo + React Native (JS) + NativeWind. UI: intuitiva, bonita, sencilla, rápida; minimalista con dark mode, animaciones suaves.

2. Features

Gestión Alimentos/Ingredientes/Recetas: Añadir/borrar/editar; clasificar con tags y carpetas; búsqueda/filtro por FODMAP nivel.
Gestión de comidas: Añadir/borrar/editar.
Gestión de agua: añadir vasos de agua, timestamps, gráfico de consumo de agua.
Gestión de tags: Añadir/borrar/editar.
Gestión de carpetas: Añadir/borrar/editar.
Tratamientos: Añadir dosis, horarios; registrar tomas con timestamps; alarmas o notificaciones.
Síntomas: Relacionar con comidas/dosis; registrar intensidad, tipo, timestamps.
Deposiciones: Registrar color, tipo (e.g., Bristol scale), urgencia/dolor/malestar, timestamps.

Actividades/Ejercicio:
- Registro de actividad: tipo (caminar, correr, yoga, natación, gimnasio, etc.), duración, intensidad, distancia (opcional), calorías (opcional), notas.
- Actividades repetitivas/programadas:
  - Configurar actividades recurrentes con periodos personalizables (diario, cada X días, días específicos de la semana, semanal, mensual).
  - Marcar actividad como completada o omitida para un día/periodo específico.
  - Visualizar actividades omitidas con estado "desactivado" en UI para feedback visual.
  - Historial de cumplimiento de actividades programadas.
- Recomendaciones inteligentes:
  - Sugerir actividades basadas en historial del usuario.
  - Mostrar actividades frecuentes como opciones rápidas.
  - Detectar patrones (ej: "Sueles caminar los lunes").
- Correlación con síntomas: relacionar actividad física con síntomas digestivos para análisis.

Calendario: Vista mes/semana/día; previsualizar tratamientos, comidas, síntomas, deposiciones, actividades; gráficos (e.g., barras para correlaciones).
Análisis: Reportes de correlaciones (síntomas vs. comidas/tratamientos/actividades).
Export/Import: Datos JSON para backups.
Settings:
- Activar/Desactivar comidas por defecto para cada día de la semana (por defecto: desayuno, almuerzo, comida, merienda, cena, otras).
- Activar/Desactivar alarmas o notificaciones.
- Lenguaje de la interfaz (español, inglés, etc.).
- Tema (claro, oscuro, automático).
- Activar/Desactivar descarga de bases de datos de recetas de repositorio abierto para guardado local.

3. Architecture

Frontend: React Native + Expo; UI con NativeWind (Tailwind) para responsive/beautiful design.
Storage: Expo-SQLite (tablas: ingredients, recipes, treatments, symptoms, bowel_movements, activities, scheduled_activities, activity_logs, calendar_events).
Networking: Fetch recetas de repositorio abierto.

4. UI/UX

Pantallas: Home (dashboard), Gestión (alimentos/recetas/tags/carpetas), Registro (tratamientos/síntomas/deposiciones/actividades), Calendario (vistas interactivas), Config.
Diseño: Bonito, agradable; iconos intuitivos, colores suaves, navegación bottom tabs + gestures; rápido con lazy loading.

5. Security/Privacy

Todo local; encriptación con Expo-SecureStore.
Descarga de bases de datos de recetas de repositorio abierto para guardado local.

6. Development Plan

Fase 1: Setup + BD extendida. ✅
Fase 2: Gestión + registro features. ✅
Fase 3: Calendario + UI polish + Actividades.
Tools: VS Code, Expo CLI, Jest.
