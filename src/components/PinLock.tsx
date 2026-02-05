import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { db, auth } from '../firebase/config';
import { Lock, Delete, ArrowRight } from 'lucide-react';
import { LoadingScreen } from './LoadingScreen';

const USER_ID = 'T8lrzfd7vFfab9SXAgMjl1AIHv33';
const PIN_KEY = 'seyaShop_pin';
const ADMIN_KEY = 'seya-admin';

interface PinLockProps {
  onUnlock: () => void;
}

const PinLock = ({ onUnlock }: PinLockProps) => {
  const [pin, setPin] = useState('');
  const [storedPin, setStoredPin] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPin = async () => {
      try {
        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }
        const snap = await getDoc(doc(db, 'users', USER_ID, 'data', PIN_KEY));
        if (snap.exists()) {
          setStoredPin(snap.data().value);
        } else {
          setIsCreating(true);
        }
      } catch (err) {
        console.error('Error loading PIN:', err);
      } finally {
        setLoading(false);
      }
    };
    loadPin();
  }, []);

  const handleDigit = (d: string) => {
    setError('');
    if (pin.length < 4) setPin(prev => prev + d);
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError('');
  };

  const handleSubmit = async () => {
    if (pin.length < 4) return;

    if (isCreating) {
      if (step === 'enter') {
        setConfirmPin(pin);
        setPin('');
        setStep('confirm');
        return;
      }
      // Confirm step
      if (pin !== confirmPin) {
        setError('Los PINs no coinciden');
        setPin('');
        setStep('enter');
        setConfirmPin('');
        return;
      }
      try {
        await setDoc(doc(db, 'users', USER_ID, 'data', PIN_KEY), {
          value: pin,
          updatedAt: new Date().toISOString(),
        });
        localStorage.setItem(ADMIN_KEY, 'true');
        onUnlock();
      } catch {
        setError('Error guardando PIN');
      }
    } else {
      if (pin === storedPin) {
        localStorage.setItem(ADMIN_KEY, 'true');
        onUnlock();
      } else {
        setError('PIN incorrecto');
        setPin('');
      }
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  const title = isCreating
    ? step === 'confirm' ? 'Confirma tu PIN' : 'Crea un PIN de acceso'
    : 'Ingresa tu PIN';

  return (
    <div className="min-h-screen bg-[#0f111a] flex items-center justify-center p-4">
      <div className="w-full max-w-xs">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-purple-900/30">
            <Lock size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-semibold text-white">{title}</h1>
          {isCreating && step === 'enter' && (
            <p className="text-sm text-gray-500 mt-1">Este PIN protege tu app</p>
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
              className="h-16 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 text-white text-2xl font-medium transition-colors"
            >
              {d}
            </button>
          ))}
          <button
            onClick={handleDelete}
            className="h-16 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 flex items-center justify-center text-gray-400 transition-colors"
          >
            <Delete size={22} />
          </button>
          <button
            onClick={() => handleDigit('0')}
            className="h-16 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 text-white text-2xl font-medium transition-colors"
          >
            0
          </button>
          <button
            onClick={handleSubmit}
            disabled={pin.length < 4}
            className="h-16 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 flex items-center justify-center text-white transition-colors"
          >
            <ArrowRight size={22} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PinLock;
