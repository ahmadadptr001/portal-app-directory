export default function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="relative w-12 h-12">
        <div className="piece absolute w-6 h-6 rounded-md bg-gradient-to-br from-blue-400 to-blue-600" style={{ animationDelay: '0ms', ['--tx' as string]: '-20px', ['--ty' as string]: '-20px', ['--rot' as string]: '-90deg' }}></div>
        <div className="piece absolute w-6 h-6 rounded-md bg-gradient-to-br from-blue-400 to-blue-600" style={{ animationDelay: '0ms', ['--tx' as string]: '20px', ['--ty' as string]: '-20px', ['--rot' as string]: '90deg' }}></div>
        <div className="piece absolute w-6 h-6 rounded-md bg-gradient-to-br from-blue-400 to-blue-600" style={{ animationDelay: '0ms', ['--tx' as string]: '-20px', ['--ty' as string]: '20px', ['--rot' as string]: '90deg' }}></div>
        <div className="piece absolute w-6 h-6 rounded-md bg-gradient-to-br from-blue-400 to-blue-600" style={{ animationDelay: '0ms', ['--tx' as string]: '20px', ['--ty' as string]: '20px', ['--rot' as string]: '-90deg' }}></div>
      </div>
      <style>{`
        .piece {
          top: 12px;
          left: 12px;
          animation: assemble 1.6s ease-in-out infinite;
        }
        @keyframes assemble {
          0% { transform: translate(var(--tx), var(--ty)) rotate(var(--rot)); opacity: 0; }
          40% { opacity: 1; }
          60% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
          80% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
          100% { transform: translate(var(--tx), var(--ty)) rotate(var(--rot)); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
