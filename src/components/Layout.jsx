import React from 'react';
import { useAuth, API_BASE_URL } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Layout({ children }) {
  const { user, logout, selectedClient, setSelectedClient, clearSelectedClient, token } = useAuth();
  const { getItemsCount } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  const [clients, setClients] = React.useState([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isOpen, setIsOpen] = React.useState(false);
  const [isMainSidebarCollapsed, setIsMainSidebarCollapsed] = React.useState(() => {
    return localStorage.getItem('mainSidebarCollapsed') === 'true';
  });
  const dropdownRef = React.useRef(null);

  const toggleMainSidebar = () => {
    setIsMainSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('mainSidebarCollapsed', next.toString());
      return next;
    });
  };


  React.useEffect(() => {
    if ((user?.role === 'Administrator' || user?.role === 'Commercial' || user?.role === 'Director') && token) {
      fetch(`${API_BASE_URL}/Catalog/clients`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setClients(data);
        }
      })
      .catch(err => console.error("Erreur chargement clients SAGE:", err));
    }
  }, [user, token]);

  React.useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', icon: 'dashboard', path: '/dashboard' },
    { name: 'Catalogue', icon: 'inventory_2', path: '/catalog' },
    { name: 'Panier', icon: 'shopping_basket', path: '/cart', badge: true },
  ];

  if (user?.role === 'Administrator') {
    navItems.push({ name: 'Import Excel', icon: 'upload_file', path: '/import-excel' });
    navItems.push({ name: 'Import Document', icon: 'description', path: '/import-document' });
    navItems.push({ name: 'Configuration SAGE', icon: 'settings', path: '/settings' });
  }

  return (
    <div className="flex min-h-screen text-on-surface bg-background">
      {/* Sidebar Navigation (Desktop) */}
      <aside className={`h-screen hidden lg:flex flex-col border-r border-outline-variant bg-surface-container-low sticky top-0 transition-all duration-300 ${
        isMainSidebarCollapsed ? 'w-20' : 'w-64'
      }`}>
        <div className="flex flex-col h-full p-4 gap-2 text-left">
          <div className="mb-8 px-2 flex justify-center w-full">
            {isMainSidebarCollapsed ? (
              <span className="text-[22px] font-black text-secondary bg-secondary/15 w-10 h-10 rounded-xl flex items-center justify-center">S</span>
            ) : (
              <div>
                <span className="text-[24px] font-black text-secondary tracking-wide">SAGE 100</span>
                <p className="text-[12px] font-bold text-outline uppercase tracking-widest mt-1">Corporate Portal</p>
              </div>
            )}
          </div>
          
          <nav className="flex-1 flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`w-full rounded-lg font-bold flex items-center transition-all duration-200 relative ${
                    isMainSidebarCollapsed ? 'justify-center p-3' : 'justify-between px-4 py-3'
                  } ${
                    isActive
                      ? 'bg-secondary-container text-on-secondary-container scale-[0.98]'
                      : 'text-on-surface-variant hover:bg-surface-variant/50'
                  }`}
                  title={isMainSidebarCollapsed ? item.name : ''}
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined">{item.icon}</span>
                    {!isMainSidebarCollapsed && <span className="text-[14px] font-semibold">{item.name}</span>}
                  </div>
                  {!isMainSidebarCollapsed && item.badge && getItemsCount() > 0 && (
                    <span className="w-5 h-5 bg-secondary text-white text-[10px] flex items-center justify-center rounded-full font-bold">
                      {getItemsCount()}
                    </span>
                  )}
                  {isMainSidebarCollapsed && item.badge && getItemsCount() > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-secondary rounded-full"></span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto pt-4 border-t border-outline-variant">
            {!isMainSidebarCollapsed ? (
              <button 
                onClick={() => navigate('/catalog')}
                className="w-full bg-primary text-on-primary font-bold py-3 px-4 rounded-xl mb-4 hover:opacity-90 active:scale-95 transition-all text-[14px]"
              >
                Nouvelle Commande
              </button>
            ) : (
              <button 
                onClick={() => navigate('/catalog')}
                className="w-10 h-10 mx-auto bg-primary text-on-primary font-bold rounded-xl mb-4 hover:opacity-90 active:scale-95 transition-all flex items-center justify-center"
                title="Nouvelle Commande"
              >
                <span className="material-symbols-outlined text-[20px]">add</span>
              </button>
            )}
            <div className="flex flex-col gap-1">
              <a 
                className={`text-on-surface-variant hover:bg-surface-variant/50 rounded-lg flex items-center gap-3 px-4 py-2 text-[14px] transition-all ${
                  isMainSidebarCollapsed ? 'justify-center' : ''
                }`} 
                href="#"
                title={isMainSidebarCollapsed ? "Aide & Support" : ""}
              >
                <span className="material-symbols-outlined text-[18px]">help</span>
                {!isMainSidebarCollapsed && <span>Aide & Support</span>}
              </a>
              <button
                onClick={handleLogout}
                className={`w-full text-left text-on-surface-variant hover:bg-surface-variant/50 rounded-lg flex items-center gap-3 px-4 py-2 text-[14px] transition-all ${
                  isMainSidebarCollapsed ? 'justify-center' : ''
                }`}
                title={isMainSidebarCollapsed ? "Se déconnecter" : ""}
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                {!isMainSidebarCollapsed && <span>Se déconnecter</span>}
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Canvas */}
      <main className="flex-1 w-full relative overflow-x-hidden flex flex-col">
        {/* Top App Bar */}
        <header className="bg-surface/80 backdrop-blur-md sticky top-0 z-50 border-b border-outline-variant">
          <div className="flex justify-between items-center w-full px-4 md:px-10 py-4 max-w-7xl mx-auto">
            <div className="flex items-center gap-4">
              <div className="lg:hidden cursor-pointer" onClick={() => navigate('/dashboard')}>
                <span className="material-symbols-outlined text-primary">menu</span>
              </div>
              <button
                onClick={toggleMainSidebar}
                className="hidden lg:flex items-center justify-center p-1.5 rounded-xl hover:bg-surface-variant/40 text-outline hover:text-on-surface transition-colors mr-2"
                title={isMainSidebarCollapsed ? "Développer le menu" : "Réduire le menu"}
              >
                <span className="material-symbols-outlined text-[22px]">
                  {isMainSidebarCollapsed ? 'menu' : 'menu_open'}
                </span>
              </button>
              <h1 className="text-[20px] md:text-[24px] font-bold tracking-tight text-primary">
                {location.pathname === '/dashboard' && 'SAGE Order Portal'}
                {location.pathname === '/catalog' && 'SAGE Catalogue'}
                {location.pathname === '/cart' && 'Récapitulatif de Commande'}
                {location.pathname === '/import-excel' && 'Importation de Commande Excel'}
                {location.pathname === '/import-document' && 'Importation de Document'}
                {location.pathname === '/settings' && 'Paramètres SAGE'}
              </h1>
            </div>
            
            <div className="flex items-center gap-4">
              {(user?.role === 'Administrator' || user?.role === 'Commercial' || user?.role === 'Director') && (
                <div className="relative mr-2" ref={dropdownRef}>
                  <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 px-4 py-2 bg-secondary/10 hover:bg-secondary/20 text-secondary rounded-full border border-secondary/30 transition-all font-semibold text-[13px]"
                  >
                    <span className="material-symbols-outlined text-[18px]">person_search</span>
                    <span>
                      {selectedClient 
                        ? `${selectedClient.name}` 
                        : (user?.role === 'Commercial' ? 'Choisir un client...' : 'SAGE par défaut...')}
                    </span>
                    <span className="material-symbols-outlined text-[16px] transition-transform duration-200">
                      {isOpen ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="absolute right-0 mt-2 w-80 bg-surface border border-outline-variant rounded-2xl shadow-xl z-[100] p-3 animate-fade-in">
                      <div className="flex items-center gap-2 bg-surface-container rounded-xl px-3 py-2 border border-outline-variant mb-2">
                        <span className="material-symbols-outlined text-outline text-[18px]">search</span>
                        <input
                          className="bg-transparent border-none focus:ring-0 text-[13px] w-full outline-none"
                          placeholder="Rechercher par nom ou code..."
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          autoFocus
                        />
                        {searchQuery && (
                          <span 
                            className="material-symbols-outlined text-outline text-[16px] cursor-pointer hover:text-on-surface"
                            onClick={() => setSearchQuery('')}
                          >
                            close
                          </span>
                        )}
                      </div>
                      
                      <div className="max-h-60 overflow-y-auto flex flex-col gap-1 pr-1 custom-scrollbar">
                        {user?.role !== 'Commercial' && (
                          <button
                            onClick={() => {
                              setSelectedClient(null);
                              setIsOpen(false);
                              setSearchQuery('');
                            }}
                            className={`w-full text-left px-3 py-2 rounded-xl text-[13px] font-semibold transition-all ${
                              !selectedClient 
                                ? 'bg-primary text-on-primary' 
                                : 'text-on-surface hover:bg-surface-container-high'
                            }`}
                          >
                            Aucun (SAGE par défaut)
                          </button>
                        )}
                        
                        {clients
                          .filter(c => 
                            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            c.ref.toLowerCase().includes(searchQuery.toLowerCase())
                          )
                          .map(client => {
                            const isSelected = selectedClient?.ref === client.ref;
                            return (
                              <button
                                key={client.ref}
                                onClick={() => {
                                  setSelectedClient(client);
                                  setIsOpen(false);
                                  setSearchQuery('');
                                }}
                                className={`w-full text-left px-3 py-2 rounded-xl text-[13px] flex flex-col transition-all ${
                                  isSelected 
                                    ? 'bg-secondary text-white' 
                                    : 'text-on-surface hover:bg-surface-container-high'
                                }`}
                              >
                                <span className="font-bold">{client.name}</span>
                                <span className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-outline'}`}>{client.ref}</span>
                              </button>
                            );
                          })
                        }
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="hidden md:flex items-center bg-surface-container rounded-full px-4 py-2 border border-outline-variant">
                <span className="material-symbols-outlined text-outline">search</span>
                <input className="bg-transparent border-none focus:ring-0 text-[14px] w-48 outline-none pl-2" placeholder="Rechercher un produit..." type="text" />
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => navigate('/cart')}
                  className="p-2 text-on-surface-variant hover:bg-surface-container-high rounded-full transition-colors active:scale-95 relative"
                >
                  <span className="material-symbols-outlined">shopping_cart</span>
                  {getItemsCount() > 0 && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-secondary rounded-full border border-surface"></span>
                  )}
                </button>
                <button className="p-2 text-on-surface-variant hover:bg-surface-container-high rounded-full transition-colors active:scale-95">
                  <span className="material-symbols-outlined">notifications</span>
                </button>
                
                <div className="flex items-center gap-3 pl-4 border-l border-outline-variant">
                  <div className="hidden md:block text-right">
                    <p className="text-[14px] font-bold text-on-surface">{user?.name || 'Jean Dupont'}</p>
                    <p className="text-[12px] text-outline">
                      {user?.role === 'Administrator' 
                        ? 'Administration des Ventes' 
                        : user?.role === 'Commercial'
                          ? 'Commercial'
                          : user?.role === 'Professional' 
                            ? 'Distributeur Premium' 
                            : 'Client Particulier'}
                    </p>
                    {(user?.role === 'Administrator' || user?.role === 'Commercial') && selectedClient && (
                      <p className="text-[10px] text-secondary font-bold">
                        Client : {selectedClient.ref}
                      </p>
                    )}
                  </div>
                  <div className="w-10 h-10 rounded-full border-2 border-outline-variant overflow-hidden cursor-pointer active:scale-95 transition-all">
                    <img 
                      className="w-full h-full object-cover" 
                      src={user?.role === 'Professional' 
                        ? "https://lh3.googleusercontent.com/aida-public/AB6AXuDD3FDhI4T3nyMCbsAqYXdarwUifGbs_A4SPDrgSO75cEO7pNDgd5XAYj6B7aU8sbNw2OYkl2QIjpEbDJTbNOBfS4_IZGYs_Ra01WdwOuebuqNfBTlXaAZ1Y9gq1KK4HEBWKAEKLblNOm81dAiJSqD4h462xYUdWDeHR8C0sFUA6eg-NCsA78Ixoi-xitTUrLyPAvcwUYp5MMcthuh_fH3ORxpUmJkEdA5Tl2HZuHS6Xu9iyy29bEYYB0u8gpRUS0EpYP7sEiFqK0Lz"
                        : "https://lh3.googleusercontent.com/aida-public/AB6AXuAtl07ceeY5AhSMYSqmCHUP24wwKUoRrd2Uw5Uzbsak4JwIsyoMXGgiQeybKkzgGg4RspqthsXguMokili9sqS7of6mehAFuq-i8HqVn58s77t10xEMf01ZU3ZSKK8BwxMOIxS2HC8zlGR1OLGHzfCApeuQ2QEnS4gNY6_xGvf-PKtYcrgbd3LE9Ui848-OFrLXXayV8hG3de_PbBNBzn-7ny0D1RhZpkXpCzqu5V1K0CjyIn8pN_54ZTLwFZFQNa5ScJB944fMqA8G"
                      }
                      alt="Avatar"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content Children */}
        <div className="flex-1">
          {children}
        </div>
      </main>

      {/* Bottom Navigation (Mobile Only) */}
      <nav className="lg:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-safe pt-2 bg-surface/90 backdrop-blur-xl border-t border-outline-variant custom-shadow">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center py-2 px-4 rounded-xl transition-all ${
                isActive ? 'text-secondary bg-secondary-fixed/30 font-bold' : 'text-on-surface-variant'
              }`}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className="text-[12px]">{item.name}</span>
            </button>
          );
        })}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center justify-center text-on-surface-variant py-2"
        >
          <span className="material-symbols-outlined">logout</span>
          <span className="text-[12px]">Quitter</span>
        </button>
      </nav>
    </div>
  );
}
