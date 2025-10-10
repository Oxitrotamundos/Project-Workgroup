# Project Workgroup

[![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/Oxitrotamundos/Gannt-Workgroup?style=flat&label=version)](https://github.com/Oxitrotamundos/Gannt-Workgroup/releases/latest)

Aplicación web de gestión de proyectos con visualización tipo Gantt, desarrollada con **React**, **TypeScript** y **Firebase**.

## Características principales

* Gráfico Gantt interactivo (wx-react-gantt)
* Gestión de tareas y dependencias
* Colaboración en tiempo real con Firestore
* Autenticación y roles de usuario
* Diseño adaptable y soporte en español

## Requisitos

* Node.js >= 18.19.0
* npm >= 9.0.0
* Proyecto Firebase con Firestore habilitado

## Instalación

```bash
git clone https://github.com/Oxitrotamundos/Gannt-Workgroup.git
cd Gannt-Workgroup
npm install
cp .env.example .env  # Agrega tu configuración de Firebase
```

Inicializa Firestore (opcional):

```bash
npm run setup:firestore
```

## Uso

Modo desarrollo:

```bash
npm run dev
```

Compilación para producción:

```bash
npm run build
npm run preview
```

## Despliegue en Firebase

```bash
npm run firebase:deploy
```

## Stack tecnológico

* **Frontend:** React + TypeScript
* **Estilos:** Tailwind CSS
* **Backend:** Firebase / Firestore
* **Gráfico Gantt:** wx-react-gantt
* **Build:** Vite

## Estructura básica

```
src/
├── components/     # Componentes React
├── contexts/       # Contextos globales
├── services/       # Capa de servicios Firestore
├── types/          # Tipos TypeScript
└── hooks/          # Hooks personalizados
```

## Contribución

1. Haz un fork del repositorio
2. Crea una rama: `git checkout -b feature/nueva-funcion`
3. Envía un Pull Request

Más información en [CONTRIBUTING.md](CONTRIBUTING.md).

