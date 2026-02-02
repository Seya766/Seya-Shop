import { motion } from 'framer-motion';
import { useMemo } from 'react';

// Generate random stars
const useStars = (count: number) => {
  return useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2.5 + 0.5,
      delay: Math.random() * 3,
      duration: Math.random() * 2 + 1,
    })), [count]);
};

// Generate warp streaks
const useStreaks = (count: number) => {
  return useMemo(() =>
    Array.from({ length: count }, (_, i) => {
      const angle = Math.random() * 360;
      const rad = (angle * Math.PI) / 180;
      return {
        id: i,
        angle,
        startX: 50 + Math.cos(rad) * 5,
        startY: 50 + Math.sin(rad) * 5,
        endX: 50 + Math.cos(rad) * 70,
        endY: 50 + Math.sin(rad) * 70,
        delay: Math.random() * 2,
        duration: Math.random() * 0.8 + 0.4,
        width: Math.random() * 1.5 + 0.5,
        color: ['#60a5fa', '#818cf8', '#a78bfa', '#c084fc', '#22d3ee', '#34d399'][Math.floor(Math.random() * 6)],
      };
    }), [count]);
};

export const LoadingScreen = () => {
  const stars = useStars(80);
  const streaks = useStreaks(30);

  return (
    <div className="min-h-screen bg-[#030014] flex flex-col items-center justify-center overflow-hidden relative">
      {/* Deep space gradient background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-radial from-indigo-950/40 via-transparent to-transparent" style={{ background: 'radial-gradient(ellipse at center, rgba(49,46,129,0.3) 0%, transparent 70%)' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 20%, rgba(14,116,144,0.15) 0%, transparent 50%)' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 70% 80%, rgba(124,58,237,0.12) 0%, transparent 50%)' }} />
      </div>

      {/* Twinkling stars */}
      {stars.map(star => (
        <motion.div
          key={star.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.size,
            height: star.size,
          }}
          animate={{ opacity: [0.1, 1, 0.1], scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: star.duration, repeat: Infinity, delay: star.delay, ease: 'easeInOut' }}
        />
      ))}

      {/* Warp speed streaks */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {streaks.map(streak => (
          <motion.line
            key={streak.id}
            x1={streak.startX}
            y1={streak.startY}
            x2={streak.startX}
            y2={streak.startY}
            stroke={streak.color}
            strokeWidth={streak.width * 0.1}
            strokeLinecap="round"
            initial={{ x2: streak.startX, y2: streak.startY, opacity: 0 }}
            animate={{
              x2: [streak.startX, streak.endX],
              y2: [streak.startY, streak.endY],
              opacity: [0, 0.8, 0],
            }}
            transition={{
              duration: streak.duration,
              repeat: Infinity,
              delay: streak.delay,
              ease: 'easeIn',
              repeatDelay: Math.random() * 1.5,
            }}
          />
        ))}
      </svg>

      {/* Central glow burst */}
      <motion.div
        className="absolute w-64 h-64 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(56,189,248,0.25) 0%, rgba(139,92,246,0.1) 40%, transparent 70%)',
          filter: 'blur(20px)',
        }}
        animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Orbital rings */}
      <motion.div
        className="absolute w-48 h-48 rounded-full border border-cyan-500/10"
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="absolute w-72 h-72 rounded-full border border-purple-500/10"
        style={{ transform: 'rotateX(60deg)' }}
        animate={{ rotate: -360 }}
        transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
      />

      {/* Logo + text center */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="relative z-10 text-center"
      >
        {/* Logo orb */}
        <div className="relative mx-auto mb-6 w-20 h-20">
          {/* Pulsing glow */}
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.5), rgba(139,92,246,0.3), transparent)' }}
            animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0.2, 0.6] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          {/* Inner orb */}
          <motion.div
            className="absolute inset-2 rounded-full bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 shadow-lg shadow-cyan-500/30 flex items-center justify-center"
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          >
            <span className="text-white font-black text-xl tracking-tight" style={{ textShadow: '0 0 20px rgba(255,255,255,0.5)' }}>S</span>
          </motion.div>
          {/* Orbiting dot */}
          <motion.div
            className="absolute w-2.5 h-2.5 bg-cyan-400 rounded-full shadow-lg shadow-cyan-400/50"
            animate={{
              x: [0, 36, 0, -36, 0],
              y: [-36, 0, 36, 0, -36],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            style={{ left: '50%', top: '50%', marginLeft: -5, marginTop: -5 }}
          />
        </div>

        {/* Title */}
        <motion.h1
          className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 mb-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          Seya Shop
        </motion.h1>

        <motion.p
          className="text-gray-400 text-sm mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1] }}
          transition={{ delay: 0.6, duration: 0.6 }}
        >
          Conectando con el universo de datos...
        </motion.p>

        {/* Progress bar */}
        <motion.div
          className="w-56 h-1 bg-gray-800/50 rounded-full overflow-hidden mx-auto backdrop-blur-sm"
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 0.8, duration: 0.4 }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, #06b6d4, #8b5cf6, #06b6d4)' }}
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>

        {/* Subtle particles floating up */}
        <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-40">
          {[0, 1, 2, 3, 4].map(i => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-cyan-400/40"
              style={{ left: `${20 + i * 15}%` }}
              animate={{ y: [-20, -80], opacity: [0, 0.8, 0], x: [0, (i % 2 === 0 ? 10 : -10)] }}
              transition={{ duration: 2 + i * 0.3, repeat: Infinity, delay: i * 0.5, ease: 'easeOut' }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
};
