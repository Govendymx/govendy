'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronRight, ThumbsUp, ThumbsDown, Calendar, ArrowLeft } from 'lucide-react';

interface DocArticleProps {
  title: string;
  description: string;
  category: string;
  categoryLink: string;
  lastUpdated: string;
  children: React.ReactNode;
}

export default function DocArticle({
  title,
  description,
  category,
  categoryLink,
  lastUpdated,
  children,
}: DocArticleProps) {
  const [feedbackGiven, setFeedbackGiven] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 pb-20 pt-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Breadcrumbs */}
        <nav className="mb-8 flex items-center text-sm text-gray-500">
          <Link href="/ayuda" className="hover:text-brand-emerald transition-colors">
            Ayuda
          </Link>
          <ChevronRight className="mx-2 h-4 w-4" />
          <Link href={categoryLink} className="hover:text-brand-emerald transition-colors">
            {category}
          </Link>
          <ChevronRight className="mx-2 h-4 w-4" />
          <span className="font-medium text-gray-900">{title}</span>
        </nav>

        {/* Back Button (Mobile) */}
        <div className="mb-6 sm:hidden">
          <Link href="/ayuda" className="flex items-center text-sm font-medium text-gray-600 hover:text-gray-900">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al Centro de Ayuda
          </Link>
        </div>

        {/* Article Header */}
        <div className="mb-10 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl"
          >
            {title}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-xl text-gray-500"
          >
            {description}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-4 flex items-center justify-center text-sm text-gray-400"
          >
            <Calendar className="mr-2 h-4 w-4" />
            Actualizado el {lastUpdated}
          </motion.div>
        </div>

        {/* Article Content */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="prose prose-lg prose-pink mx-auto rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5"
        >
          {children}
        </motion.div>

        {/* Feedback Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-12 text-center"
        >
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5 inline-block">
            <h3 className="text-lg font-medium text-gray-900">¿Te resultó útil este artículo?</h3>
            {!feedbackGiven ? (
              <div className="mt-4 flex justify-center space-x-4">
                <button
                  onClick={() => setFeedbackGiven(true)}
                  className="flex items-center rounded-full bg-white px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 transition-colors"
                >
                  <ThumbsUp className="mr-2 h-4 w-4" />
                  Sí, gracias
                </button>
                <button
                  onClick={() => setFeedbackGiven(true)}
                  className="flex items-center rounded-full bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
                >
                  <ThumbsDown className="mr-2 h-4 w-4" />
                  No mucho
                </button>
              </div>
            ) : (
              <p className="mt-4 text-sm text-green-600 font-medium">
                ¡Gracias por tus comentarios! Nos ayudan a mejorar.
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
