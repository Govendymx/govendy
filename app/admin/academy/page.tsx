'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  AcademicCapIcon, 
  PlayCircleIcon, 
  CheckBadgeIcon, 
  BookOpenIcon,
  BeakerIcon
} from '@heroicons/react/24/outline';

// Mock Data (Simulando la BD definida en supabase_academy.sql)
const MODULES = [
  {
    id: '1',
    title: 'Dominio de la Plataforma GoVendy',
    description: 'Programa educativo estructurado para eliminar errores recurrentes y dominar todas las funcionalidades.',
    category: 'Admin',
    level: 'Avanzado',
    lessons: 3,
    progress: 0
  },
  {
    id: '2',
    title: 'Gestión de Pagos y Fraude',
    description: 'Aprende a identificar transacciones sospechosas y manejar disputas eficientemente.',
    category: 'Risk',
    level: 'Intermedio',
    lessons: 5,
    progress: 0
  },
  {
    id: '3',
    title: 'Soporte al Cliente de Clase Mundial',
    description: 'Protocolos de comunicación y resolución de conflictos para usuarios.',
    category: 'Support',
    level: 'Básico',
    lessons: 4,
    progress: 0
  }
];

export default function AcademyPage() {
  const [activeTab, setActiveTab] = useState<'courses' | 'simulator' | 'certifications'>('courses');

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <AcademicCapIcon className="h-8 w-8 text-brand-emerald" />
            Pocket Academy
          </h1>
          <p className="text-gray-500 mt-1">
            Sistema de entrenamiento y certificación para el equipo.
          </p>
        </div>
        
        <div className="flex gap-2 bg-white p-1 rounded-lg border shadow-sm">
          <button
            onClick={() => setActiveTab('courses')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'courses' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Cursos
          </button>
          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'simulator' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Simulador
          </button>
          <button
            onClick={() => setActiveTab('certifications')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'certifications' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Mis Certificaciones
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="min-h-[500px]">
        {activeTab === 'courses' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {MODULES.map((module) => (
              <motion.div
                key={module.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl border shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="h-32 bg-gradient-to-br from-gray-900 to-gray-800 p-6 flex items-center justify-center">
                  <BookOpenIcon className="h-12 w-12 text-white/50" />
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      module.level === 'Avanzado' ? 'bg-red-100 text-red-800' :
                      module.level === 'Intermedio' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {module.level}
                    </span>
                    <h3 className="text-lg font-semibold text-gray-900 mt-2">{module.title}</h3>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{module.description}</p>
                  </div>

                  <div className="flex items-center justify-between text-sm text-gray-500 pt-4 border-t">
                    <span>{module.lessons} Lecciones</span>
                    <span>{module.progress}% Completado</span>
                  </div>

                  <button className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white py-2.5 rounded-lg hover:bg-gray-800 transition-colors">
                    <PlayCircleIcon className="h-5 w-5" />
                    Iniciar Módulo
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {activeTab === 'simulator' && (
          <div className="bg-white rounded-xl border p-8 text-center space-y-6">
            <div className="mx-auto h-24 w-24 bg-purple-100 rounded-full flex items-center justify-center">
              <BeakerIcon className="h-12 w-12 text-purple-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Simulador de Casos Reales</h2>
              <p className="text-gray-500 max-w-lg mx-auto mt-2">
                Practica la resolución de problemas en un entorno seguro sin afectar datos reales.
                Enfréntate a escenarios generados por IA basados en incidentes pasados.
              </p>
            </div>
            <button className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors">
              Iniciar Simulación Práctica
            </button>
          </div>
        )}

        {activeTab === 'certifications' && (
          <div className="bg-white rounded-xl border p-12 text-center">
            <CheckBadgeIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Aún no tienes certificaciones</h3>
            <p className="text-gray-500 mt-1">Completa los módulos y aprueba los exámenes finales para obtener tu insignia.</p>
          </div>
        )}
      </div>
    </div>
  );
}
