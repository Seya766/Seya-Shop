import { motion } from 'framer-motion';

export const LoadingScreen = () => {
  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center overflow-hidden relative">
      {/* Subtle background grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
        }}
      />
      {/* Radial fade on grid edges */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, transparent 20%, #09090b 70%)' }}
      />

      {/* Slow rotating ambient glow */}
      <motion.div
        className="absolute w-[480px] h-[480px] rounded-full"
        style={{
          background:
            'conic-gradient(from 0deg, rgba(6,182,212,0.06), rgba(99,102,241,0.05), rgba(139,92,246,0.06), rgba(6,182,212,0.06))',
          filter: 'blur(80px)',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      />

      {/* Glass card */}
      <motion.div
        className="relative z-10 flex flex-col items-center px-14 py-12 rounded-2xl"
        style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.05)',
          backdropFilter: 'blur(24px)',
          boxShadow: '0 0 80px rgba(6,182,212,0.03), 0 0 40px rgba(139,92,246,0.02)',
        }}
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Logo */}
        <div className="relative mb-8">
          {/* Subtle glow behind logo */}
          <motion.div
            className="absolute inset-0 scale-[2.5]"
            style={{
              background: 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)',
              filter: 'blur(12px)',
            }}
            animate={{ opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />

          <svg width="56" height="56" viewBox="0 0 56 56" fill="none" className="relative">
            {/* Static ring */}
            <motion.circle
              cx="28"
              cy="28"
              r="26"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
              fill="none"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            />

            {/* Spinning gradient arc */}
            <motion.circle
              cx="28"
              cy="28"
              r="26"
              stroke="url(#seyaGrad)"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeDasharray="18 146"
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              style={{ transformOrigin: 'center' }}
            />

            {/* Center letter */}
            <motion.text
              x="28"
              y="34"
              textAnchor="middle"
              fill="url(#seyaGrad)"
              fontSize="20"
              fontWeight="800"
              fontFamily="system-ui, -apple-system, sans-serif"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.4 }}
            >
              S
            </motion.text>

            <defs>
              <linearGradient id="seyaGrad" x1="0" y1="0" x2="56" y2="56">
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="50%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#a78bfa" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Brand */}
        <motion.h1
          className="text-xl font-semibold text-white/90 tracking-tight"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          Seya Shop
        </motion.h1>

        <motion.p
          className="text-[11px] text-white/25 tracking-[0.2em] uppercase mt-1.5 mb-7 font-light"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          Preparando todo
        </motion.p>

        {/* Slim progress line */}
        <motion.div
          className="w-44 h-[2px] bg-white/[0.04] rounded-full overflow-hidden"
          initial={{ opacity: 0, scaleX: 0.6 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 0.6, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            className="h-full w-1/3 rounded-full"
            style={{
              background: 'linear-gradient(90deg, transparent, #22d3ee, #8b5cf6, transparent)',
            }}
            animate={{ x: ['-100%', '400%'] }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: [0.45, 0, 0.55, 1],
            }}
          />
        </motion.div>
      </motion.div>
    </div>
  );
};
