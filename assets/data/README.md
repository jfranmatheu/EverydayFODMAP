# Everyday FODMAP - Base de Datos Interna

Esta carpeta contiene los datos predefinidos de la aplicación.

## Estructura

```
assets/data/
├── foods/           # Alimentos individuales
│   ├── zanahoria.json
│   ├── zanahoria.jpg     # Imagen opcional (mismo nombre)
│   ├── ajo.json
│   └── ...
├── recipes/         # Recetas
│   ├── arroz-con-pollo.json
│   ├── arroz-con-pollo.jpg   # Imagen opcional
│   └── ...
└── README.md
```

## Formato de Alimento (Food)

```json
{
  "id": "zanahoria",
  "name": "Zanahoria",
  "category": "vegetable",
  "fodmap_level": "low",
  "fodmap_details": {
    "fructans": "low",
    "gos": "low",
    "lactose": "low",
    "fructose": "low",
    "sorbitol": "low",
    "mannitol": "low",
    "overall": "low",
    "safe_serving": "75g"
  },
  "serving_size": "75g (1 mediana)",
  "nutrition": {
    "calories": 31,
    "carbs_g": 7,
    "fiber_g": 2,
    "protein_g": 0.7,
    "fat_g": 0.2
  },
  "notes": "Notas adicionales opcionales"
}
```

## Formato de Receta (Recipe)

```json
{
  "id": "arroz-con-pollo",
  "name": "Arroz con Pollo bajo en FODMAP",
  "description": "Un clásico plato reconfortante",
  "fodmap_level": "low",
  "prep_time": 15,
  "cook_time": 35,
  "servings": 4,
  "difficulty": "easy",
  "meal_types": ["lunch", "dinner"],
  "cuisine": "Española",
  "dietary": ["gluten-free", "dairy-free"],
  "ingredients": [
    {
      "name": "Pechuga de pollo",
      "quantity": 400,
      "unit": "g",
      "fodmap_level": "low"
    }
  ],
  "steps": [
    {
      "order": 1,
      "title": "Preparación",
      "instruction": "Sazona el pollo con sal y pimentón"
    }
  ],
  "notes": "Notas adicionales"
}
```

## Categorías de Alimentos

- `vegetable` - Verduras
- `fruit` - Frutas
- `grain` - Cereales/Granos
- `protein` - Proteínas
- `dairy` - Lácteos
- `fat` - Grasas/Aceites
- `beverage` - Bebidas
- `condiment` - Condimentos
- `processed` - Procesados
- `other` - Otros

## Niveles FODMAP

- `low` - Bajo (verde) ✅
- `medium` - Medio (amarillo) ⚠️
- `high` - Alto (rojo) ❌
- `unknown` - Desconocido (gris)

## Imágenes

Las imágenes son opcionales y deben tener el mismo nombre que el archivo JSON:
- `arroz-con-pollo.json` → `arroz-con-pollo.jpg` o `.png`

