import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setLocalError('Veuillez remplir tous les champs.');
      return;
    }
    setLocalError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setLocalError(err.message || 'Identifiants de connexion invalides.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden select-none">
      {/* Background Decorative Elements */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[5%] w-[40%] h-[40%] rounded-full bg-secondary/5 blur-[120px]"></div>
        <div className="absolute top-[60%] -right-[10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[120px]"></div>
        
        {/* Floating Shapes */}
        <div className="absolute top-20 right-40 hidden md:block opacity-20">
          <div className="w-32 h-32 rounded-2xl bg-white shadow-xl flex items-center justify-center rotate-12 floating-element">
            <span className="material-symbols-outlined text-secondary text-4xl">add</span>
          </div>
        </div>
        <div className="absolute bottom-20 left-40 hidden md:block opacity-20">
          <div className="w-48 h-16 rounded-xl bg-white shadow-xl flex items-center px-4 -rotate-6 floating-element" style={{ animationDelay: '1s' }}>
            <div className="w-8 h-8 rounded-full bg-secondary-fixed mr-3"></div>
            <div className="h-2 w-24 bg-surface-variant rounded-full"></div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <main className="relative z-10 w-full max-w-[1100px] grid lg:grid-cols-2 gap-8 items-center">
        {/* Brand / Identity Section */}
        <div className="hidden lg:flex flex-col space-y-8 pr-12 text-left">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg">
                <span className="material-symbols-outlined text-white text-3xl">hub</span>
              </div>
              <div>
                <h1 className="font-semibold text-[24px] text-primary tracking-tight">SAGE Order Portal</h1>
                <p className="text-[14px] font-medium text-slate-gray">Intégration SAGE 100 native</p>
              </div>
            </div>
            <h2 className="text-[48px] font-bold text-primary leading-tight">
              Simplifiez vos <br />
              <span className="text-secondary">commandes B2B</span>
            </h2>
            <p className="text-[18px] text-on-surface-variant max-w-md">
              Accédez à votre catalogue personnalisé, suivez vos stocks en temps réel et gérez vos commandes en toute simplicité.
            </p>
          </div>
          
          {/* Mini Stats Card */}
          <div className="glass-panel p-6 rounded-[24px] shadow-sm flex gap-6 items-center w-fit">
            <div className="flex flex-col">
              <span className="text-[12px] font-semibold text-slate-gray uppercase tracking-widest mb-1">Status</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success-emerald animate-pulse"></div>
                <span className="text-[14px] text-on-surface font-semibold">Connecté SAGE</span>
              </div>
            </div>
            <div className="w-[1px] h-10 bg-outline-variant"></div>
            <div className="flex flex-col">
              <span className="text-[12px] font-semibold text-slate-gray uppercase tracking-widest mb-1">Mise à jour</span>
              <span className="text-[14px] text-on-surface font-semibold">Il y a 2 min</span>
            </div>
          </div>
        </div>

        {/* Login Card */}
        <div className="flex justify-center lg:justify-end">
          <div className="w-full max-w-[440px] bg-white rounded-[32px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] border border-white/50 p-8 md:p-10 relative overflow-hidden text-left">
            {/* Subtle Gradient Header */}
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-secondary to-primary-container"></div>
            
            <div className="flex flex-col items-center mb-10 lg:hidden">
              <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center shadow-lg mb-4">
                <span className="material-symbols-outlined text-white text-3xl">hub</span>
              </div>
              <h2 className="text-[24px] font-bold text-primary">SAGE Order Portal</h2>
            </div>
            
            <div className="mb-8">
              <h3 className="text-[24px] font-bold text-primary mb-2">Bienvenue</h3>
              <p className="text-[16px] text-on-surface-variant">Connectez-vous pour accéder à votre espace client.</p>
            </div>

            {localError && (
              <div className="mb-6 p-4 bg-error-container text-on-error-container rounded-2xl text-[14px] font-medium flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">error</span>
                <span>{localError}</span>
              </div>
            )}

            <form className="space-y-6" onSubmit={handleSubmit}>
              {/* Email / Client Ref */}
              <div className="space-y-2">
                <label className="block text-[14px] font-medium text-on-surface-variant" htmlFor="identifier">
                  Email ou Réf. Client
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-outline group-focus-within:text-secondary transition-colors">
                    <span className="material-symbols-outlined text-[20px]">person</span>
                  </div>
                  <input
                    className="w-full h-[56px] pl-12 pr-4 bg-surface-container-low border-none rounded-2xl text-[16px] text-on-surface focus:ring-2 focus:ring-secondary/20 focus:bg-white transition-all outline-none"
                    id="identifier"
                    name="identifier"
                    placeholder="ex: pro@plmtechinfo.com"
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              
              {/* Password */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-[14px] font-medium text-on-surface-variant" htmlFor="password">
                    Mot de passe
                  </label>
                  <a className="text-[12px] font-semibold text-secondary hover:underline" href="#">
                    Mot de passe oublié ?
                  </a>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-outline group-focus-within:text-secondary transition-colors">
                    <span className="material-symbols-outlined text-[20px]">lock</span>
                  </div>
                  <input
                    className="w-full h-[56px] pl-12 pr-12 bg-surface-container-low border-none rounded-2xl text-[16px] text-on-surface focus:ring-2 focus:ring-secondary/20 focus:bg-white transition-all outline-none"
                    id="password"
                    name="password"
                    placeholder="••••••••"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    className="absolute inset-y-0 right-4 flex items-center text-outline hover:text-on-surface transition-colors"
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>
              
              {/* Remember Me */}
              <div className="flex items-center gap-3">
                <input
                  className="w-5 h-5 rounded border-outline-variant text-secondary focus:ring-secondary cursor-pointer"
                  id="remember"
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <label className="text-[16px] text-on-surface-variant cursor-pointer select-none" htmlFor="remember">
                  Rester connecté
                </label>
              </div>
              
              {/* Submit Button */}
              <button
                className="w-full h-[56px] bg-primary text-on-primary font-bold text-[18px] rounded-2xl shadow-xl shadow-primary/10 hover:shadow-primary/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                    <span>Connexion...</span>
                  </>
                ) : (
                  <>
                    <span>Se connecter</span>
                    <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                  </>
                )}
              </button>
            </form>
            
            <div className="mt-10 pt-8 border-t border-outline-variant/30 text-center">
              <p className="text-[16px] text-on-surface-variant mb-4">Nouveau partenaire ?</p>
              <a className="inline-flex items-center justify-center w-full h-[52px] border-2 border-outline-variant text-primary font-semibold text-[14px] rounded-2xl hover:bg-surface-container-low transition-colors" href="#">
                Demander un accès pro
              </a>
            </div>
            
            {/* Security Note */}
            <div className="mt-8 flex items-center justify-center gap-2 opacity-60">
              <span className="material-symbols-outlined text-[16px]">verified_user</span>
              <span className="text-[12px] font-semibold uppercase tracking-wider">Connexion Sécurisée AES-256</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-6 left-0 w-full lg:hidden text-center px-6 pointer-events-none">
        <p className="text-[12px] text-slate-gray pointer-events-auto">
          © 2024 SAGE Order Portal • <a className="hover:text-primary transition-colors" href="#">Mentions légales</a>
        </p>
      </footer>
    </div>
  );
}
