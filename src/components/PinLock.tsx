import { useState } from 'react';
import { Lock, Delete, ArrowRight } from 'lucide-react';
import { useTenant } from '../context/TenantContext';

interface PinLockProps {
  onUnlock: () => void;
}

const PinLock = ({ onUnlock }: PinLockProps) => {
  const { tenants, login } = useTenant();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if this is first time setup (admin has no PIN)
  const isFirstTime = tenants.length === 1 && tenants[0].isAdmin && !tenants[0].pin;

  const handleDigit = (d: string) => {
    setError('');
    if (pin.length < 4) setPin(prev => prev + d);
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError('');
  };

  const handleSubmit = async () => {
    if (pin.length < 4 || isSubmitting) return;
    setIsSubmitting(true);

    try {
      if (isFirstTime) {
        // First time setup: create admin PIN
        if (step === 'enter') {
          setConfirmPin(pin);
          setPin('');
          setStep('confirm');
          setIsSubmitting(false);
          return;
        }
        // Confirm step
        if (pin !== confirmPin) {
          setError('Los PINs no coinciden');
          setPin('');
          setStep('enter');
          setConfirmPin('');
          setIsSubmitting(false);
          return;
        }
      }

      // Attempt login (will also handle first-time admin PIN setup)
      const success = await login(pin);
      if (success) {
        onUnlock();
      } else {
        setError('PIN incorrecto');
        setPin('');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = isFirstTime
    ? step === 'confirm' ? 'Confirma tu PIN' : 'Crea tu PIN de Admin'
    : 'Ingresa tu PIN';

  const subtitle = isFirstTime && step === 'enter'
    ? 'Primera vez: crea un PIN para acceder'
    : null;

  return (
    <div className="min-h-screen bg-[#0f111a] flex items-center justify-center p-4">
      <div className="w-full max-w-xs">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-purple-900/30">
            <Lock size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-semibold text-white">{title}</h1>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>

        {/* PIN dots */}
        <div className="flex justify-center gap-4 mb-8">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full transition-all duration-200 ${
                i < pin.length
                  ? 'bg-purple-500 scale-110'
                  : 'bg-gray-700/50 border border-gray-600'
              }`}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <p className="text-center text-red-400 text-sm mb-4">{error}</p>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
            <button
              key={d}
              onClick={() => handleDigit(d)}
              disabled={isSubmitting}
              className="h-16 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 text-white text-2xl font-medium transition-colors disabled:opacity-50"
            >
              {d}
            </button>
          ))}
          <button
            onClick={handleDelete}
            disabled={isSubmitting}
            className="h-16 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 flex items-center justify-center text-gray-400 transition-colors disabled:opacity-50"
          >
            <Delete size={22} />
          </button>
          <button
            onClick={() => handleDigit('0')}
            disabled={isSubmitting}
            className="h-16 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 text-white text-2xl font-medium transition-colors disabled:opacity-50"
          >
            0
          </button>
          <button
            onClick={handleSubmit}
            disabled={pin.length < 4 || isSubmitting}
            className="h-16 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 flex items-center justify-center text-white transition-colors"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <ArrowRight size={22} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PinLock;
