import { motion } from 'framer-motion';
import { Cloud, Database } from 'lucide-react';

export const LoadingScreen = () => {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="relative mb-6">
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl"
          />
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="relative"
          >
            <Cloud className="w-16 h-16 text-blue-400 mx-auto" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="absolute -bottom-2 left-1/2 -translate-x-1/2"
          >
            <Database className="w-6 h-6 text-green-400" />
          </motion.div>
        </div>

        <h2 className="text-xl font-semibold text-white mb-2">
          Conectando con Firebase
        </h2>
        <p className="text-gray-400 text-sm">
          Sincronizando tus datos...
        </p>

        <div className="mt-6 w-48 h-1 bg-gray-800 rounded-full overflow-hidden mx-auto">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </motion.div>
    </div>
  );
};