import React, { useEffect, useState } from 'react';
import { useAuth, API_BASE_URL } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';

export default function Dashboard() {
  const { user, token } = useAuth();
  const { getCartTotal } = useCart();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // États pour les tiroirs d'historique et de détails
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [lastSyncTime, setLastSyncTime] = useState(new Date());
  const [syncText, setSyncText] = useState("Dernière mise à jour SAGE 100 : à l'instant.");

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/Order/history`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!response.ok) {
          throw new Error('Erreur lors de la récupération de l\'historique.');
        }
        const data = await response.json();
        setOrders(data);
        setLastSyncTime(new Date());
        setSyncText("Dernière mise à jour SAGE 100 : à l'instant.");
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchHistory();
    }
  }, [token]);

  // Timer dynamique pour afficher le temps relatif depuis la dernière synchro
  useEffect(() => {
    const interval = setInterval(() => {
      const diffMs = new Date() - lastSyncTime;
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins === 0) {
        const diffSecs = Math.floor(diffMs / 1000);
        if (diffSecs < 10) {
          setSyncText("Dernière mise à jour SAGE 100 : à l'instant.");
        } else {
          setSyncText(`Dernière mise à jour SAGE 100 : il y a ${diffSecs} secondes.`);
        }
      } else {
        setSyncText(`Dernière mise à jour SAGE 100 : il y a ${diffMins} minute${diffMins > 1 ? 's' : ''}.`);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [lastSyncTime]);

  const activeOrdersCount = orders.filter(o => o.status === 'En cours' || o.status === 'Validée' || o.status === 'Livraison en cours').length;

  // Filtrer les commandes pour le tiroir d'historique complet
  const filteredOrders = orders.filter((order) => {
    const matchesSearch = 
      order.orderRef?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.sageOrderRef?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.status?.toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesStatus = statusFilter === 'All' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <Layout>
      <div className="px-4 md:px-10 py-8 max-w-7xl mx-auto space-y-8 text-left">
        {/* Welcome Section */}
        <section className="relative rounded-3xl overflow-hidden glass-header p-8 lg:p-12 text-white shadow-xl">
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <span className="text-[14px] font-semibold bg-white/10 px-3 py-1 rounded-full border border-white/20 mb-4 inline-block">
                Tableau de bord
              </span>
              <h2 className="text-[32px] font-extrabold mb-2">
                Bienvenue, {user?.name.split(' ')[0] || 'Jean-Pierre'}
              </h2>
              <p className="text-[16px] text-white/70 max-w-lg">
                Votre portail SAGE 100 est synchronisé. Voici un aperçu de vos activités récentes et de vos commandes en cours.
              </p>
            </div>
            <div>
              <button 
                onClick={() => navigate('/catalog')}
                className="bg-white text-primary px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-white/90 active:scale-95 transition-all shadow-md"
              >
                <span className="material-symbols-outlined">add_shopping_cart</span>
                Passer commande
              </button>
            </div>
          </div>
          {/* Background aesthetic element */}
          <div className="absolute top-0 right-0 w-1/3 h-full opacity-20 pointer-events-none overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-l from-secondary to-transparent"></div>
          </div>
        </section>

        {/* Stats Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-[24px] custom-shadow border border-outline-variant/30 flex items-center justify-between group hover:-translate-y-1 transition-all duration-300">
            <div>
              <p className="text-on-surface-variant text-[14px] font-medium mb-1">Total Commandes</p>
              <h3 className="text-[24px] font-bold">{orders.length}</h3>
              <span className="text-success-emerald text-[14px] font-semibold flex items-center gap-1 mt-2">
                <span className="material-symbols-outlined text-[16px]">trending_up</span> +12% ce mois
              </span>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-primary-fixed flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
              <span className="material-symbols-outlined">shopping_bag</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[24px] custom-shadow border border-outline-variant/30 flex items-center justify-between group hover:-translate-y-1 transition-all duration-300">
            <div>
              <p className="text-on-surface-variant text-[14px] font-medium mb-1">Commandes Actives</p>
              <h3 className="text-[24px] font-bold">{activeOrdersCount}</h3>
              <span className="text-on-surface-variant/60 text-[14px] flex items-center gap-1 mt-2">
                En attente de traitement
              </span>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-secondary-fixed flex items-center justify-center text-secondary group-hover:bg-secondary group-hover:text-white transition-colors">
              <span className="material-symbols-outlined">sync</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[24px] custom-shadow border border-outline-variant/30 flex items-center justify-between group hover:-translate-y-1 transition-all duration-300">
            <div>
              <p className="text-on-surface-variant text-[14px] font-medium mb-1">Valeur du Panier</p>
              <h3 className="text-[24px] font-bold">{getCartTotal().toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</h3>
              <span className="text-secondary text-[14px] font-semibold flex items-center gap-1 mt-2 cursor-pointer hover:underline" onClick={() => navigate('/cart')}>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span> Finaliser maintenant
              </span>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-tertiary-fixed flex items-center justify-center text-tertiary group-hover:bg-tertiary group-hover:text-white transition-colors">
              <span className="material-symbols-outlined">payments</span>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Orders List */}
          <section className="lg:col-span-2 space-y-4">
            <div className="flex justify-between items-end px-2">
              <h3 className="text-[20px] font-bold text-primary">Commandes Récentes</h3>
              <button 
                onClick={() => setShowHistoryModal(true)}
                className="text-secondary font-bold text-[14px] hover:underline"
              >
                Voir tout
              </button>
            </div>
            
            <div className="bg-white rounded-3xl custom-shadow overflow-hidden border border-outline-variant/30">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-surface-container-low text-on-surface-variant uppercase text-[10px] tracking-widest font-bold">
                    <tr>
                      <th className="px-6 py-4">ID Commande</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Lignes</th>
                      <th className="px-6 py-4">Statut SAGE</th>
                      <th className="px-6 py-4">Total</th>
                      <th className="px-6 py-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {loading ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-10 text-center text-outline">
                          <span className="material-symbols-outlined animate-spin text-4xl">progress_activity</span>
                        </td>
                      </tr>
                    ) : error ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-10 text-center text-error font-medium">
                          {error}
                        </td>
                      </tr>
                    ) : orders.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-10 text-center text-outline font-medium">
                          Aucune commande trouvée.
                        </td>
                      </tr>
                    ) : (
                      orders.slice(0, 5).map((order) => (
                        <tr 
                          key={order.id} 
                          onClick={() => setSelectedOrderDetail(order)}
                          className="hover:bg-surface-container-lowest transition-all hover:translate-x-0.5 duration-200 cursor-pointer"
                        >
                          <td className="px-6 py-5 font-semibold text-primary">{order.orderRef}</td>
                          <td className="px-6 py-5 text-on-surface-variant">
                            {new Date(order.orderDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-6 py-5">{order.orderLines?.length || 0} articles</td>
                          <td className="px-6 py-5">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                              order.status === 'Facturée' 
                                ? 'bg-purple-100 text-purple-800'
                                : order.status === 'Livraison en cours'
                                ? 'bg-blue-100 text-blue-800'
                                : order.status === 'Validée'
                                ? 'bg-success-emerald/20 text-success-emerald'
                                : order.status === 'Devis'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-secondary-fixed text-on-secondary-fixed'
                            }`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="px-6 py-5 font-bold text-primary">
                            {order.totalAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                          </td>
                          <td className="px-6 py-5 text-right" onClick={(e) => e.stopPropagation()}>
                            <button 
                              onClick={() => setSelectedOrderDetail(order)}
                              className="p-2 hover:bg-surface-variant rounded-lg transition-colors"
                            >
                              <span className="material-symbols-outlined text-outline">chevron_right</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Quick Access / Secondary Info */}
          <section className="space-y-6">
            <div className="flex justify-between items-end px-2">
              <h3 className="text-[20px] font-bold text-primary">Accès Rapide</h3>
            </div>
            
            <div className="space-y-4">
              {/* Catalog Card */}
              <div 
                onClick={() => navigate('/catalog')}
                className="relative group cursor-pointer overflow-hidden rounded-3xl h-40 bg-white border border-outline-variant/30 custom-shadow"
              >
                <div className="absolute inset-0 z-0 scale-105 group-hover:scale-100 transition-transform duration-500 opacity-60">
                  <img 
                    className="w-full h-full object-cover" 
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuBCRi_0-nkOx4hyDVoceEaGPt1DNQphT54QGTv2SIEsr8us228YpvXHbnnerbaE32XY6k2375NooNDR7V9RZMh0lMajh6SGpjpgCwgb30eOcWAD8Z5LhXwZ6p98hh-jwxfw5DDRQr0TcaElJxSvF8BgRlgPTScdhAOXFR7UWrnmHdjiYUnHmgHiwxbfSi0HjZlA2ns3dSeD0uRK4LrXpt7EOFCgCZA_qRLyXjnMspoYuYpD_DqfWXtvmjerYIQSiP4KAbhHKmJYvnyi" 
                    alt="Warehouse" 
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-white via-white/80 to-transparent z-10"></div>
                <div className="relative z-20 p-6 flex flex-col justify-end h-full">
                  <h4 className="text-[20px] font-bold text-primary">Catalogue Produits</h4>
                  <p className="text-on-surface-variant text-[14px]">Parcourir toutes nos références SAGE</p>
                </div>
                <div className="absolute top-4 right-4 z-20 w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 -translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                  <span className="material-symbols-outlined">arrow_outward</span>
                </div>
              </div>

              {/* History Card */}
              <div className="bg-white p-6 rounded-3xl border border-outline-variant/30 custom-shadow flex items-start gap-4 hover:border-secondary transition-all">
                <div className="w-12 h-12 bg-secondary-container rounded-2xl flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined">history</span>
                </div>
                <div>
                  <h4 className="font-bold text-[16px] text-primary">Historique</h4>
                  <p className="text-on-surface-variant text-[14px] mb-3">Retrouvez toutes vos factures et bons de livraison.</p>
                  <button 
                    onClick={() => setShowHistoryModal(true)}
                    className="text-secondary text-[14px] font-bold flex items-center gap-1 hover:gap-2 transition-all"
                  >
                    Consulter mes archives <span className="material-symbols-outlined text-[14px]">east</span>
                  </button>
                </div>
              </div>

              {/* Integration Status Card */}
              <div className="bg-surface-container-high/50 p-6 rounded-3xl border border-dashed border-outline flex flex-col items-center text-center">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-success-emerald animate-pulse"></div>
                  <span className="text-[12px] font-bold uppercase tracking-tighter text-on-surface-variant">
                    Synchronisation Active
                  </span>
                </div>
                <p className="text-[12px] text-on-surface-variant">{syncText}</p>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* TIROIR 1 : Historique Complet des Commandes (Slide-over) */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setShowHistoryModal(false)}
          ></div>
          
          <div className="relative w-full max-w-2xl h-full bg-surface shadow-2xl flex flex-col z-10 animate-slide-in-right border-l border-outline-variant/30">
            {/* Header */}
            <div className="px-6 py-6 border-b border-outline-variant flex items-center justify-between bg-white">
              <div>
                <h2 className="text-[20px] font-black text-primary">Archives & Historique</h2>
                <p className="text-[13px] text-outline">Consulter toutes vos commandes synchronisées</p>
              </div>
              <button 
                onClick={() => setShowHistoryModal(false)}
                className="w-10 h-10 rounded-full hover:bg-surface-container-high flex items-center justify-center text-outline hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Barre de recherche et filtres */}
            <div className="p-6 bg-white border-b border-outline-variant/50 space-y-4">
              <div className="flex items-center bg-surface-container rounded-xl px-4 py-2 border border-outline-variant">
                <span className="material-symbols-outlined text-outline">search</span>
                <input
                  className="bg-transparent border-none focus:ring-0 text-[14px] w-full outline-none pl-2 focus:outline-none"
                  placeholder="Rechercher par réf SAGE ou statut..."
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <span 
                    className="material-symbols-outlined text-outline cursor-pointer hover:text-on-surface"
                    onClick={() => setSearchQuery('')}
                  >
                    close
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {['All', 'Validée', 'En cours', 'Livraison en cours', 'Facturée', 'Devis'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-bold transition-all ${
                      statusFilter === status
                        ? 'bg-secondary text-white shadow-sm'
                        : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-variant/70'
                    }`}
                  >
                    {status === 'All' ? 'Toutes' : status === 'Devis' ? 'Devis' : status}
                  </button>
                ))}
              </div>
            </div>

            {/* Liste des commandes */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {filteredOrders.length === 0 ? (
                <div className="text-center py-12 text-outline font-medium">
                  Aucune commande correspondante.
                </div>
              ) : (
                filteredOrders.map((order) => (
                  <div 
                    key={order.id}
                    onClick={() => setSelectedOrderDetail(order)}
                    className="bg-white p-5 rounded-2xl border border-outline-variant/30 custom-shadow hover:border-secondary cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-bold text-primary text-[15px]">{order.orderRef}</h4>
                        <p className="text-[12px] text-outline">
                          {new Date(order.orderDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold ${
                        order.status === 'Facturée' 
                          ? 'bg-purple-100 text-purple-800'
                          : order.status === 'Livraison en cours'
                          ? 'bg-blue-100 text-blue-800'
                          : order.status === 'Validée'
                          ? 'bg-success-emerald/20 text-success-emerald'
                          : order.status === 'Devis'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-secondary-fixed text-on-secondary-fixed'
                      }`}>
                        {order.status}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[13px] border-t border-outline-variant/10 pt-3">
                      <span className="text-on-surface-variant font-medium">
                        <strong className="text-primary font-extrabold">{order.orderLines?.length || 0}</strong> article(s)
                      </span>
                      <span className="font-extrabold text-secondary text-[15px]">
                        {order.totalAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TIROIR 2 : Détails d'une Commande (Slide-over de niveau supérieur) */}
      {selectedOrderDetail && (
        <div className="fixed inset-0 z-[110] flex justify-end">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setSelectedOrderDetail(null)}
          ></div>
          
          <div className="relative w-full max-w-xl h-full bg-surface shadow-2xl flex flex-col z-10 animate-slide-in-right border-l border-outline-variant/30">
            {/* Header */}
            <div className="px-6 py-6 border-b border-outline-variant flex items-center justify-between bg-white">
              <div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold mb-2 ${
                  selectedOrderDetail.status === 'Facturée' 
                    ? 'bg-purple-100 text-purple-800'
                    : selectedOrderDetail.status === 'Livraison en cours'
                    ? 'bg-blue-100 text-blue-800'
                    : selectedOrderDetail.status === 'Validée'
                    ? 'bg-success-emerald/20 text-success-emerald'
                    : selectedOrderDetail.status === 'Devis'
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-secondary-fixed text-on-secondary-fixed'
                }`}>
                  {selectedOrderDetail.status}
                </span>
                <h2 className="text-[20px] font-black text-primary">{selectedOrderDetail.orderRef}</h2>
                <p className="text-[12px] text-outline">
                  Passée le {new Date(selectedOrderDetail.orderDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-2 bg-secondary/10 hover:bg-secondary/20 text-secondary rounded-xl flex items-center gap-1.5 transition-all font-semibold text-[13px]"
                >
                  <span className="material-symbols-outlined text-[18px]">print</span>
                  <span>Imprimer</span>
                </button>
                <button 
                  onClick={() => setSelectedOrderDetail(null)}
                  className="w-10 h-10 rounded-full hover:bg-surface-container-high flex items-center justify-center text-outline hover:text-on-surface transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            {/* Zone de contenu */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {/* Infos en-tête SAGE */}
              <div className="bg-white p-5 rounded-2xl border border-outline-variant/30 custom-shadow">
                <h3 className="font-bold text-[13px] text-primary mb-3 uppercase tracking-wider">Informations SAGE 100</h3>
                <div className="grid grid-cols-2 gap-4 text-[13px]">
                  <div>
                    <p className="text-outline">Réf Pièce SAGE</p>
                    <p className="font-bold text-on-surface">{selectedOrderDetail.sageOrderRef || "En attente"}</p>
                  </div>
                  <div>
                    <p className="text-outline">Compte Client</p>
                    <p className="font-bold text-on-surface">{selectedOrderDetail.customerRef}</p>
                  </div>
                </div>
              </div>

              {/* Adresse de livraison */}
              <div className="bg-white p-5 rounded-2xl border border-outline-variant/30 custom-shadow">
                <h3 className="font-bold text-[13px] text-primary mb-3 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px] text-secondary">local_shipping</span>
                  Adresse de Livraison
                </h3>
                <div className="text-[13px] space-y-1">
                  <p className="font-bold text-on-surface">{selectedOrderDetail.deliveryAddressName || "Adresse principale (SAGE)"}</p>
                  {selectedOrderDetail.deliveryStreet && <p className="text-on-surface-variant">{selectedOrderDetail.deliveryStreet}</p>}
                  {selectedOrderDetail.deliveryCity && <p className="text-on-surface-variant">{selectedOrderDetail.deliveryCity}</p>}
                  {!selectedOrderDetail.deliveryStreet && !selectedOrderDetail.deliveryCity && (
                    <p className="text-outline italic">Adresse par défaut de la fiche client SAGE.</p>
                  )}
                </div>
              </div>

              {/* Tableau des articles */}
              <div className="bg-white rounded-2xl border border-outline-variant/30 custom-shadow overflow-hidden">
                <div className="px-5 py-4 bg-surface-container-low border-b border-outline-variant/30">
                  <h3 className="font-bold text-[13px] text-primary uppercase tracking-wider">Articles Commandés</h3>
                </div>
                
                <div className="divide-y divide-outline-variant/20 max-h-64 overflow-y-auto">
                  {(!selectedOrderDetail.orderLines || selectedOrderDetail.orderLines.length === 0) ? (
                    <div className="p-6 text-center text-outline italic text-[13px]">
                      Aucun détail d'article disponible pour ce document.
                    </div>
                  ) : (
                    selectedOrderDetail.orderLines.map((line) => (
                      <div key={line.id} className="p-4 flex justify-between items-start gap-4 hover:bg-surface-container-lowest text-left">
                        <div className="space-y-1 flex-1">
                          <p className="font-bold text-primary text-[13px]">{line.productName || "Article sans désignation"}</p>
                          <p className="text-[11px] text-outline font-semibold uppercase tracking-wider">{line.productRef}</p>
                          <p className="text-[12px] text-on-surface-variant">
                            {line.quantity} x {line.unitPrice.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                          </p>
                        </div>
                        <div className="text-right font-extrabold text-primary text-[14px] pt-1">
                          {(line.quantity * line.unitPrice).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Résumé financier */}
                <div className="p-5 bg-surface-container-low border-t border-outline-variant/30 text-[13px] space-y-2">
                  <div className="flex justify-between text-on-surface-variant">
                    <span>Montant HT</span>
                    <span className="font-bold">{selectedOrderDetail.totalAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                  </div>
                  <div className="flex justify-between text-on-surface-variant">
                    <span>TVA (20%)</span>
                    <span className="font-bold">{(selectedOrderDetail.totalAmount * 0.2).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                  </div>
                  <div className="flex justify-between text-primary font-extrabold text-[15px] border-t border-outline-variant/20 pt-2">
                    <span>Total TTC</span>
                    <span>{(selectedOrderDetail.totalAmount * 1.2).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                  </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}

      {/* Element caché pour l'impression A4 */}
      {selectedOrderDetail && (
        <div id="print-section" className="hidden print:block p-8 bg-white text-black font-sans leading-relaxed text-left">
          {/* En-tête */}
          <div className="flex justify-between items-start border-b-2 border-slate-300 pb-6 mb-6">
            <div>
              <h1 className="text-[24px] font-black tracking-wide text-slate-800">PORTAIL SAGE 100</h1>
              <p className="text-[12px] text-slate-500 font-bold uppercase tracking-widest mt-1">Bon de Commande & Devis</p>
            </div>
            <div className="text-right">
              <h2 className="text-[20px] font-black text-slate-700">
                {selectedOrderDetail.status === 'Devis' ? 'DEVIS COMMERCIAL' : 'BON DE COMMANDE'}
              </h2>
              <p className="text-[14px] font-bold text-slate-600 mt-1">N° {selectedOrderDetail.sageOrderRef || selectedOrderDetail.orderRef}</p>
              <p className="text-[12px] text-slate-500 font-medium">Date: {new Date(selectedOrderDetail.orderDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
            </div>
          </div>

          {/* Destinataire & Livraison */}
          <div className="grid grid-cols-2 gap-8 mb-8 text-[13px]">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h3 className="font-bold text-slate-700 mb-2 uppercase tracking-wider text-[11px]">Informations Client</h3>
              <p className="font-bold text-slate-800">Référence Client SAGE : {selectedOrderDetail.customerRef}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h3 className="font-bold text-slate-700 mb-2 uppercase tracking-wider text-[11px]">Lieu de Livraison</h3>
              <p className="font-bold text-slate-800">{selectedOrderDetail.deliveryAddressName || "Adresse principale (SAGE)"}</p>
              {selectedOrderDetail.deliveryStreet && <p className="text-slate-600 mt-0.5">{selectedOrderDetail.deliveryStreet}</p>}
              {selectedOrderDetail.deliveryCity && <p className="text-slate-600 mt-0.5">{selectedOrderDetail.deliveryCity}</p>}
            </div>
          </div>

          {/* Tableau des articles */}
          <table className="w-full text-left border-collapse border border-slate-300 text-[13px] mb-8">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                <th className="p-3 border border-slate-300">Référence</th>
                <th className="p-3 border border-slate-300">Désignation</th>
                <th className="p-3 border border-slate-300 text-center" style={{ width: '100px' }}>Quantité</th>
                <th className="p-3 border border-slate-300 text-right" style={{ width: '120px' }}>Prix Unitaire HT</th>
                <th className="p-3 border border-slate-300 text-right" style={{ width: '120px' }}>Montant HT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {selectedOrderDetail.orderLines?.map((line, index) => (
                <tr key={index} className="text-slate-800">
                  <td className="p-3 border border-slate-300 font-bold font-mono">{line.productRef}</td>
                  <td className="p-3 border border-slate-300 font-medium">{line.productName || "Article sans désignation"}</td>
                  <td className="p-3 border border-slate-300 text-center font-bold">{line.quantity}</td>
                  <td className="p-3 border border-slate-300 text-right">{line.unitPrice.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</td>
                  <td className="p-3 border border-slate-300 text-right font-bold">{(line.quantity * line.unitPrice).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totaux financiers */}
          <div className="flex justify-end mb-12">
            <div className="w-64 space-y-2.5 text-[13px] bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex justify-between text-slate-600">
                <span>Total HT</span>
                <span className="font-bold">{selectedOrderDetail.totalAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>TVA (20%)</span>
                <span className="font-bold">{(selectedOrderDetail.totalAmount * 0.2).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
              </div>
              <div className="flex justify-between text-slate-800 font-bold border-t border-slate-300 pt-2 text-[15px]">
                <span>Total TTC</span>
                <span>{(selectedOrderDetail.totalAmount * 1.2).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-12 mt-16 text-[12px] border-t border-slate-200 pt-8">
            <div className="text-center h-28 flex flex-col justify-between">
              <p className="font-bold text-slate-600 uppercase tracking-wider">Cachet & Signature Client</p>
              <p className="text-slate-400 italic">Mention "Bon pour accord"</p>
            </div>
            <div className="text-center h-28 flex flex-col justify-between">
              <p className="font-bold text-slate-600 uppercase tracking-wider">Signature Commercial (Représentant)</p>
              <p className="text-slate-800 font-bold underline mt-4">{user?.name}</p>
            </div>
          </div>
        </div>
      )}

      {/* Style print */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-section, #print-section * {
            visibility: visible;
          }
          #print-section {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            display: block !important;
          }
        }
      `}</style>
    </Layout>
  );
}
