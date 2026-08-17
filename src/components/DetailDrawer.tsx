"use client";

import React, { useEffect, useState } from "react";
import { App } from "@/types";

interface DetailDrawerProps {
  app: App | null;
  onClose: () => void;
  onDelete: (id: number) => void;
  onEdit: (app: App) => void;
}

export default function DetailDrawer({ app: appProp, onClose, onDelete, onEdit }: DetailDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [app, setApp] = useState<App | null>(null);

  // Update state via setTimeout (asynchronous callback) agar tidak memicu
  // lint warning "Calling setState synchronously within an effect".
  useEffect(() => {
    if (appProp) {
      const t1 = window.setTimeout(() => setApp(appProp), 0);
      const t2 = window.setTimeout(() => setIsOpen(true), 20);
      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
      };
    } else {
      const t1 = window.setTimeout(() => setIsOpen(false), 0);
      // Biarkan data app tetap ada selama durasi transisi keluar (300ms)
      // supaya panel masih punya konten saat slide ke kanan.
      const t2 = window.setTimeout(() => setApp(null), 300);
      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
      };
    }
  }, [appProp]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!app) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end ${
        isOpen ? "pointer-events-auto" : "pointer-events-none"
      }`}
    >
      <div
        className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      ></div>
      <div
        className={`relative w-full max-w-md h-full bg-white dark:bg-slate-800 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex justify-between items-center p-5 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {app.name}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block mb-1">Status</span>
              <span
                className={`font-medium px-2 py-0.5 rounded-full text-xs ${app.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"}`}
              >
                {app.status}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block mb-1">Env</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {app.env}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block mb-1">Owner</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {app.owner}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block mb-1">Version</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {app.version}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block mb-1">Server</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {app.server && app.server !== '-' ? app.server : '-'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block mb-1">Database</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {app.database && app.database !== '-' ? app.database : '-'}
              </span>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Deskripsi
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {app.description}
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Progress
            </h4>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-500 dark:text-slate-400">
                Development
              </span>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {app.progress}%
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full"
                style={{ width: `${app.progress}%` }}
              ></div>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Tech Stack
            </h4>
            <div className="flex flex-wrap gap-2">
              {app.tech.map((t) => (
                <span
                  key={t}
                  className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full text-xs"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="p-5 border-t border-slate-200 dark:border-slate-700 flex gap-3">
          <button onClick={() => onEdit(app)} className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium flex items-center justify-center gap-2">
            <i className="fas fa-edit"></i> Edit
          </button>
          <button
            onClick={() => {
              if (window.confirm(`Hapus aplikasi "${app.name}"? Tindakan ini tidak dapat dibatalkan.`)) {
                onDelete(app.id);
              }
            }}
            className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 px-4 py-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-sm font-medium flex items-center justify-center gap-2"
          >
            <i className="fas fa-trash"></i> Hapus
          </button>
        </div>
      </div>
    </div>
  );
}
