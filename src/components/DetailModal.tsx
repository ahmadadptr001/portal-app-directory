"use client";

import React from 'react';
import { App } from '@/types';

interface DetailModalProps {
  app: App | null;
  onClose: () => void;
}

export default function DetailModal({ app, onClose }: DetailModalProps) {
  if (!app) return null;
  // Hanya tautan http(s) yang aman untuk dibuka; selain itu disembunyikan
  // (cek javascript: dll) agar URL dari data tidak jadi vektor XSS.
  const safeUrl = /^https?:\/\//i.test(app.url || '') ? app.url : '#';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{app.name}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-slate-500 dark:text-slate-400">Status:</span> <span className="font-medium ml-2 text-slate-800 dark:text-slate-200">{app.status}</span></div>
            <div><span className="text-slate-500 dark:text-slate-400">Env:</span> <span className="font-medium ml-2 text-slate-800 dark:text-slate-200">{app.env}</span></div>
            <div><span className="text-slate-500 dark:text-slate-400">Owner:</span> <span className="font-medium ml-2 text-slate-800 dark:text-slate-200">{app.owner}</span></div>
            <div><span className="text-slate-500 dark:text-slate-400">Version:</span> <span className="font-medium ml-2 text-slate-800 dark:text-slate-200">{app.version}</span></div>
            <div><span className="text-slate-500 dark:text-slate-400">Server:</span> <span className="font-medium ml-2 text-slate-800 dark:text-slate-200">{app.server && app.server !== '-' ? app.server : '-'}</span></div>
            <div><span className="text-slate-500 dark:text-slate-400">Database:</span> <span className="font-medium ml-2 text-slate-800 dark:text-slate-200">{app.database && app.database !== '-' ? app.database : '-'}</span></div>
          </div>
          <div>
            <p className="text-slate-600 dark:text-slate-400">{app.description}</p>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-500 dark:text-slate-400">Progress</span>
              <span className="font-medium text-slate-700 dark:text-slate-200">{app.progress}%</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
              <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${app.progress}%` }}></div>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Tech Stack</h4>
            <div className="flex flex-wrap gap-2">
              {app.tech.map(t => (
                <span key={t} className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full text-xs">{t}</span>
              ))}
            </div>
          </div>
          <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="inline-block bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm mt-4">
            <i className="fas fa-external-link-alt mr-2"></i> Buka Aplikasi
          </a>
        </div>
      </div>
    </div>
  );
}
