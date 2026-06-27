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

  // Rôles et Navigation d'activité
  const [activeTab, setActiveTab] = useState(() => {
    return (user?.role === 'Director') ? 'stats' : 'personal';
  });

  // États pour le Dashboard de Statistiques Direction
  const [selectedDocTypes, setSelectedDocTypes] = useState([1, 3, 6]); // 1 = Commandes, 3 = Livraisons, 6 = Factures
  const [includeReturns, setIncludeReturns] = useState(true); // Inclure 4 (Retours) et 5 (Avoirs)
  const [datePreset, setDatePreset] = useState('30days'); // today, week, month, 30days, year, custom
  
  // Fonctions utilitaires de calcul de dates
  const getStartDateForPreset = (preset) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (preset === 'today') return d;
    if (preset === 'week') {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff);
      return d;
    }
    if (preset === 'month') {
      return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    if (preset === '30days') {
      d.setDate(d.getDate() - 30);
      return d;
    }
    if (preset === 'year') {
      return new Date(d.getFullYear(), 0, 1);
    }
    return d;
  };

  const getComparisonRange = (start, end) => {
    const durationMs = end.getTime() - start.getTime();
    const compEnd = new Date(start.getTime() - 86400000);
    compEnd.setHours(23, 59, 59, 999);
    const compStart = new Date(compEnd.getTime() - durationMs);
    compStart.setHours(0, 0, 0, 0);
    return { start: compStart, end: compEnd };
  };

  const [startDate, setStartDate] = useState(() => getStartDateForPreset('30days'));
  const [endDate, setEndDate] = useState(() => new Date());
  const [compareMode, setCompareMode] = useState(true);
  const [compareStartDate, setCompareStartDate] = useState(() => getComparisonRange(getStartDateForPreset('30days'), new Date()).start);
  const [compareEndDate, setCompareEndDate] = useState(() => getComparisonRange(getStartDateForPreset('30days'), new Date()).end);

  const [statsData, setStatsData] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(null);

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const month = '' + (d.getMonth() + 1);
    const day = '' + d.getDate();
    const year = d.getFullYear();
    return [year, month.padStart(2, '0'), day.padStart(2, '0')].join('-');
  };

  const fetchStats = async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const typesList = [...selectedDocTypes];
      if (includeReturns) {
        typesList.push(4, 5);
      }
      const typesParam = typesList.join(',');
      const startStr = formatDate(startDate);
      const endStr = formatDate(endDate);
      let url = `${API_BASE_URL}/Dashboard/stats?docTypes=${typesParam}&startDate=${startStr}&endDate=${endStr}`;
      
      if (compareMode && compareStartDate && compareEndDate) {
        url += `&compareStartDate=${formatDate(compareStartDate)}&compareEndDate=${formatDate(compareEndDate)}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Erreur lors du chargement des statistiques.');
      }
      const data = await response.json();
      setStatsData(data);
    } catch (err) {
      setStatsError(err.message);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    if ((user?.role === 'Director' || user?.role === 'Administrator') && token) {
      fetchStats();
    }
  }, [selectedDocTypes, includeReturns, startDate, endDate, compareMode, compareStartDate, compareEndDate, token]);

  const handleDatePresetChange = (preset) => {
    setDatePreset(preset);
    if (preset === 'custom') return;
    
    const start = getStartDateForPreset(preset);
    const end = new Date();
    setStartDate(start);
    setEndDate(end);

    const comp = getComparisonRange(start, end);
    setCompareStartDate(comp.start);
    setCompareEndDate(comp.end);
  };

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

  const renderStatsDashboard = () => {
    if (statsLoading && !statsData) {
      return (
        <div className="min-h-[400px] flex items-center justify-center text-outline">
          <span className="material-symbols-outlined animate-spin text-5xl text-secondary">progress_activity</span>
        </div>
      );
    }

    if (statsError) {
      return (
        <div className="p-6 bg-error-container text-on-error-container rounded-2xl font-bold flex items-center gap-2">
          <span className="material-symbols-outlined">error</span>
          <span>{statsError}</span>
        </div>
      );
    }

    const primary = statsData?.primary || { totalSales: 0, documentsCount: 0, avgBasket: 0 };
    const comparison = statsData?.comparison;

    // Calculer les pourcentages d'évolution
    const getChangePercent = (current, previous) => {
      if (!compareMode || !previous || previous === 0) return null;
      const change = ((current - previous) / previous) * 100;
      return Math.round(change * 10) / 10;
    };

    const salesChange = getChangePercent(primary.totalSales, comparison?.totalSales);
    const docsChange = getChangePercent(primary.documentsCount, comparison?.documentsCount);
    const basketChange = getChangePercent(primary.avgBasket, comparison?.avgBasket);

    // Calculer le max des ventes quotidiennes pour l'échelle Y du graphique
    const maxVal = Math.max(
      ... (statsData?.dailySales || []).map(d => d.amount),
      ... (statsData?.comparisonDailySales || []).map(d => d.amount),
      100 // valeur min par défaut
    );

    // Slices pour le graphique Donut (familles de produits)
    const families = statsData?.salesByFamily || [];
    const totalFamilySales = families.reduce((sum, f) => sum + f.amount, 0);
    let accumulatedPercent = 0;
    const donutCircumference = 282.74; // 2 * Math.PI * 45 (r=45)

    const colors = [
      'stroke-primary',     // bleu
      'stroke-secondary',   // orange
      'stroke-tertiary',    // vert
      'stroke-error',       // rouge
      'stroke-outline'      // gris
    ];
    const fillColors = [
      'bg-primary',
      'bg-secondary',
      'bg-tertiary',
      'bg-error',
      'bg-outline'
    ];

    const donutSlices = families.map((f, i) => {
      const share = totalFamilySales > 0 ? f.amount / totalFamilySales : 0;
      const percent = share * 100;
      const strokeDashArray = `${(share * donutCircumference).toFixed(2)} ${donutCircumference}`;
      const strokeDashOffset = (-accumulatedPercent * donutCircumference).toFixed(2);
      accumulatedPercent += share;
      return {
        ...f,
        percent: Math.round(percent * 10) / 10,
        strokeDashArray,
        strokeDashOffset,
        colorClass: colors[i % colors.length],
        fillClass: fillColors[i % fillColors.length]
      };
    });

    return (
      <div className="space-y-6 animate-fade-in text-left">
        {/* Barre de filtres et d'outils */}
        <section className="bg-white p-5 rounded-3xl border border-outline-variant/30 custom-shadow flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Presets et selecteurs de dates */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[13px] font-semibold text-on-surface-variant">Période :</span>
              <select
                value={datePreset}
                onChange={(e) => handleDatePresetChange(e.target.value)}
                className="h-10 px-3 bg-surface border border-outline-variant/30 rounded-xl text-[13px] font-semibold outline-none"
              >
                <option value="today">Aujourd'hui</option>
                <option value="week">Cette semaine</option>
                <option value="month">Ce mois-ci</option>
                <option value="30days">30 derniers jours</option>
                <option value="year">Année en cours</option>
                <option value="custom">Plage personnalisée</option>
              </select>

              {datePreset === 'custom' && (
                <div className="flex items-center gap-2 animate-fade-in">
                  <input
                    type="date"
                    value={formatDate(startDate)}
                    onChange={(e) => setStartDate(new Date(e.target.value))}
                    className="h-10 px-2 bg-surface border border-outline-variant/30 rounded-xl text-[13px] outline-none"
                  />
                  <span className="text-outline text-[12px]">au</span>
                  <input
                    type="date"
                    value={formatDate(endDate)}
                    onChange={(e) => setEndDate(new Date(e.target.value))}
                    className="h-10 px-2 bg-surface border border-outline-variant/30 rounded-xl text-[13px] outline-none"
                  />
                </div>
              )}
            </div>

            {/* Checkbox de comparaison */}
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-[13px] font-semibold text-on-surface-variant cursor-pointer">
                <input
                  type="checkbox"
                  checked={compareMode}
                  onChange={(e) => setCompareMode(e.target.checked)}
                  className="rounded border-outline-variant/50 text-secondary focus:ring-secondary w-4 h-4"
                />
                Comparer à la période précédente
              </label>

              {compareMode && datePreset === 'custom' && (
                <div className="flex items-center gap-2 ml-4 animate-fade-in">
                  <input
                    type="date"
                    value={formatDate(compareStartDate)}
                    onChange={(e) => setCompareStartDate(new Date(e.target.value))}
                    className="h-10 px-2 bg-surface border border-outline-variant/30 rounded-xl text-[13px] outline-none"
                  />
                  <span className="text-outline text-[12px]">au</span>
                  <input
                    type="date"
                    value={formatDate(compareEndDate)}
                    onChange={(e) => setCompareEndDate(new Date(e.target.value))}
                    className="h-10 px-2 bg-surface border border-outline-variant/30 rounded-xl text-[13px] outline-none"
                  />
                </div>
              )}
            </div>
          </div>

          <hr className="border-outline-variant/20" />

          {/* Filtres de types de documents */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="text-[13px] font-semibold text-on-surface-variant">Types de documents :</span>
            
            <label className="flex items-center gap-2 text-[13px] font-medium text-primary cursor-pointer">
              <input
                type="checkbox"
                checked={selectedDocTypes.includes(1)}
                onChange={(e) => {
                  if (e.target.checked) setSelectedDocTypes([...selectedDocTypes, 1]);
                  else setSelectedDocTypes(selectedDocTypes.filter(t => t !== 1));
                }}
                className="rounded border-outline-variant/50 text-primary focus:ring-primary w-4 h-4"
              />
              Bons de commande
            </label>

            <label className="flex items-center gap-2 text-[13px] font-medium text-primary cursor-pointer">
              <input
                type="checkbox"
                checked={selectedDocTypes.includes(3)}
                onChange={(e) => {
                  if (e.target.checked) setSelectedDocTypes([...selectedDocTypes, 3]);
                  else setSelectedDocTypes(selectedDocTypes.filter(t => t !== 3));
                }}
                className="rounded border-outline-variant/50 text-secondary focus:ring-secondary w-4 h-4"
              />
              Bons de livraison
            </label>

            <label className="flex items-center gap-2 text-[13px] font-medium text-primary cursor-pointer">
              <input
                type="checkbox"
                checked={selectedDocTypes.includes(6)}
                onChange={(e) => {
                  if (e.target.checked) setSelectedDocTypes([...selectedDocTypes, 6]);
                  else setSelectedDocTypes(selectedDocTypes.filter(t => t !== 6));
                }}
                className="rounded border-outline-variant/50 text-tertiary focus:ring-tertiary w-4 h-4"
              />
              Factures
            </label>

            <div className="h-4 w-px bg-outline-variant/40 hidden sm:block"></div>

            <label className="flex items-center gap-2 text-[13px] font-medium text-primary cursor-pointer">
              <input
                type="checkbox"
                checked={includeReturns}
                onChange={(e) => setIncludeReturns(e.target.checked)}
                className="rounded border-outline-variant/50 text-error focus:ring-error w-4 h-4"
              />
              Déduire Retours & Avoirs
            </label>
          </div>
        </section>

        {/* KPIs Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card Chiffre d'Affaires Net */}
          <div className="bg-white p-6 rounded-[24px] custom-shadow border border-outline-variant/30 flex items-center justify-between group hover:-translate-y-1 transition-all duration-300">
            <div className="space-y-1">
              <p className="text-on-surface-variant text-[13px] font-semibold mb-1 uppercase tracking-wider">Chiffre d'Affaires Net</p>
              <h3 className="text-[24px] font-black text-primary">
                {primary.totalSales.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Dhs
              </h3>
              {compareMode && comparison && (
                <div className="flex flex-col gap-0.5 mt-2">
                  <div className="flex items-center gap-1">
                    {salesChange !== null && (
                      <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                        salesChange >= 0 ? 'bg-success-emerald/10 text-success-emerald' : 'bg-error/10 text-error'
                      }`}>
                        <span className="material-symbols-outlined text-[14px]">
                          {salesChange >= 0 ? 'trending_up' : 'trending_down'}
                        </span>
                        {salesChange >= 0 ? '+' : ''}{salesChange}%
                      </span>
                    )}
                    <span className="text-outline text-[11px]">vs période précédente</span>
                  </div>
                  <span className="text-[11px] text-outline italic">({comparison.totalSales.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Dhs)</span>
                </div>
              )}
            </div>
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[28px]">payments</span>
            </div>
          </div>

          {/* Card Documents émis */}
          <div className="bg-white p-6 rounded-[24px] custom-shadow border border-outline-variant/30 flex items-center justify-between group hover:-translate-y-1 transition-all duration-300">
            <div className="space-y-1">
              <p className="text-on-surface-variant text-[13px] font-semibold mb-1 uppercase tracking-wider">Documents Émis</p>
              <h3 className="text-[24px] font-black text-secondary">
                {primary.documentsCount}
              </h3>
              {compareMode && comparison && (
                <div className="flex flex-col gap-0.5 mt-2">
                  <div className="flex items-center gap-1">
                    {docsChange !== null && (
                      <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                        docsChange >= 0 ? 'bg-success-emerald/10 text-success-emerald' : 'bg-error/10 text-error'
                      }`}>
                        <span className="material-symbols-outlined text-[14px]">
                          {docsChange >= 0 ? 'trending_up' : 'trending_down'}
                        </span>
                        {docsChange >= 0 ? '+' : ''}{docsChange}%
                      </span>
                    )}
                    <span className="text-outline text-[11px]">vs période précédente</span>
                  </div>
                  <span className="text-[11px] text-outline italic">({comparison.documentsCount} documents)</span>
                </div>
              )}
            </div>
            <div className="w-14 h-14 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-[28px]">description</span>
            </div>
          </div>

          {/* Card Panier Moyen */}
          <div className="bg-white p-6 rounded-[24px] custom-shadow border border-outline-variant/30 flex items-center justify-between group hover:-translate-y-1 transition-all duration-300">
            <div className="space-y-1">
              <p className="text-on-surface-variant text-[13px] font-semibold mb-1 uppercase tracking-wider">Panier Moyen</p>
              <h3 className="text-[24px] font-black text-tertiary">
                {primary.avgBasket.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Dhs
              </h3>
              {compareMode && comparison && (
                <div className="flex flex-col gap-0.5 mt-2">
                  <div className="flex items-center gap-1">
                    {basketChange !== null && (
                      <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                        basketChange >= 0 ? 'bg-success-emerald/10 text-success-emerald' : 'bg-error/10 text-error'
                      }`}>
                        <span className="material-symbols-outlined text-[14px]">
                          {basketChange >= 0 ? 'trending_up' : 'trending_down'}
                        </span>
                        {basketChange >= 0 ? '+' : ''}{basketChange}%
                      </span>
                    )}
                    <span className="text-outline text-[11px]">vs période précédente</span>
                  </div>
                  <span className="text-[11px] text-outline italic">({comparison.avgBasket.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Dhs)</span>
                </div>
              )}
            </div>
            <div className="w-14 h-14 rounded-2xl bg-tertiary/10 flex items-center justify-center text-tertiary">
              <span className="material-symbols-outlined text-[28px]">shopping_basket</span>
            </div>
          </div>
        </section>

        {/* Graphiques Section */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Évolution Journalière Chart */}
          <div className="bg-white p-6 rounded-[24px] custom-shadow border border-outline-variant/30 lg:col-span-2 space-y-4">
            <h4 className="text-[15px] font-bold text-primary uppercase tracking-wider">Évolution Journalière des Ventes</h4>
            
            <div className="relative pt-4 h-64 border-b border-l border-outline-variant/30 flex items-end">
              {statsLoading ? (
                <div className="absolute inset-0 flex items-center justify-center text-outline">
                  <span className="material-symbols-outlined animate-spin text-3xl">progress_activity</span>
                </div>
              ) : (
                <svg className="w-full h-full overflow-visible" viewBox="0 0 500 200" preserveAspectRatio="none">
                  {/* Grille horizontale */}
                  <line x1="0" y1="50" x2="500" y2="50" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="0" y1="100" x2="500" y2="100" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="0" y1="150" x2="500" y2="150" stroke="#f1f5f9" strokeWidth="1" />
                  
                  {/* Courbe Période Précédente (Dashed Gray Line) */}
                  {compareMode && statsData?.comparisonDailySales && statsData.comparisonDailySales.length > 0 && (
                    <path
                      d={getPathDataForSvg(statsData.comparisonDailySales, 500, 200, maxVal)}
                      fill="none"
                      stroke="#cbd5e1"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                    />
                  )}

                  {/* Courbe Période Principale (Blue Line) */}
                  {statsData?.dailySales && statsData.dailySales.length > 0 && (
                    <>
                      {/* Gradient Fill under curve */}
                      <path
                        d={`${getPathDataForSvg(statsData.dailySales, 500, 200, maxVal)} L 500 200 L 0 200 Z`}
                        fill="url(#chartGrad)"
                        opacity="0.15"
                      />
                      {/* Line curve */}
                      <path
                        d={getPathDataForSvg(statsData.dailySales, 500, 200, maxVal)}
                        fill="none"
                        stroke="#2563eb"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </>
                  )}

                  {/* Définitions des Gradients */}
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" />
                      <stop offset="100%" stopColor="#ffffff" />
                    </linearGradient>
                  </defs>
                </svg>
              )}

              {/* Tooltip Légende graphique */}
              <div className="absolute top-0 right-0 flex items-center gap-4 text-[11px] font-bold text-outline">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-1 bg-primary rounded"></span>
                  <span>Période principale</span>
                </div>
                {compareMode && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-1 bg-slate-300 rounded border-dashed border-t border-b"></span>
                    <span>Période précédente</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Axe X du graphique */}
            <div className="flex justify-between text-[10px] text-outline font-semibold px-2">
              <span>{formatDate(startDate)}</span>
              <span>{formatDate(endDate)}</span>
            </div>
          </div>

          {/* Répartition par Famille (Donut Chart) */}
          <div className="bg-white p-6 rounded-[24px] custom-shadow border border-outline-variant/30 space-y-4">
            <h4 className="text-[15px] font-bold text-primary uppercase tracking-wider">Répartition par Famille</h4>
            
            <div className="flex flex-col items-center justify-center pt-2">
              {donutSlices.length === 0 ? (
                <div className="h-32 flex items-center justify-center text-outline text-[13px] italic">
                  Aucune vente enregistrée.
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 w-full">
                  {/* SVG Donut */}
                  <div className="relative w-36 h-36">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="transparent" stroke="#f1f5f9" strokeWidth="12" />
                      {donutSlices.map((slice, i) => (
                        <circle
                          key={slice.name}
                          cx="50"
                          cy="50"
                          r="40"
                          fill="transparent"
                          className={`${slice.colorClass}`}
                          strokeWidth="12"
                          strokeDasharray={slice.strokeDashArray}
                          strokeDashoffset={slice.strokeDashOffset}
                          strokeLinecap="round"
                        />
                      ))}
                    </svg>
                    {/* Texte intérieur du Donut */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[16px] font-extrabold text-primary">
                        {donutSlices[0]?.percent || 0}%
                      </span>
                      <span className="text-[9px] text-outline font-bold uppercase tracking-wider">
                        {donutSlices[0]?.name.split(' ')[0] || 'Top'}
                      </span>
                    </div>
                  </div>

                  {/* Légende détaillée */}
                  <div className="w-full space-y-2 text-left">
                    {donutSlices.map((slice) => (
                      <div key={slice.name} className="flex items-center justify-between text-[12px] font-medium">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${slice.fillClass}`}></span>
                          <span className="truncate text-on-surface">{slice.name}</span>
                        </div>
                        <span className="font-bold text-primary font-mono pl-2">{slice.percent}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Top Clients & Leaderboard */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Top Clients Progress list */}
          <div className="bg-white p-6 rounded-[24px] custom-shadow border border-outline-variant/30 space-y-4 text-left">
            <h4 className="text-[15px] font-bold text-primary uppercase tracking-wider">Top 5 Clients</h4>
            
            {statsData?.topClients && statsData.topClients.length > 0 ? (
              <div className="space-y-4">
                {statsData.topClients.map((client, i) => {
                  const maxAmt = statsData.topClients[0].amount;
                  const ratio = maxAmt > 0 ? (client.amount / maxAmt) * 100 : 0;
                  return (
                    <div key={client.name} className="space-y-1.5">
                      <div className="flex justify-between items-center text-[13px] font-semibold">
                        <span className="text-on-surface truncate pr-4">{i + 1}. {client.name}</span>
                        <span className="text-primary font-bold">{client.amount.toLocaleString('fr-FR')} Dhs</span>
                      </div>
                      <div className="w-full h-3 bg-surface-container rounded-full overflow-hidden">
                        <div
                          style={{ width: `${ratio}%` }}
                          className="h-full bg-gradient-to-r from-primary to-blue-400 rounded-full transition-all duration-1000"
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-outline text-[13px] italic">Aucun client trouvé.</div>
            )}
          </div>

          {/* Commercial Leaderboard */}
          <div className="bg-white p-6 rounded-[24px] custom-shadow border border-outline-variant/30 space-y-4 text-left">
            <h4 className="text-[15px] font-bold text-primary uppercase tracking-wider">Performance des Commerciaux</h4>
            
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant/30 text-outline font-bold uppercase text-[10px] tracking-wider">
                    <th className="pb-3 text-left">Commerciaux</th>
                    <th className="pb-3 text-center">Docs</th>
                    <th className="pb-3 text-right">CA HT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20 font-medium">
                  {statsData?.commercialPerformance && statsData.commercialPerformance.length > 0 ? (
                    statsData.commercialPerformance.map((com, i) => {
                      const rankColors = [
                        'bg-amber-500 text-white',  // Or
                        'bg-slate-400 text-white',  // Argent
                        'bg-amber-700 text-white',  // Bronze
                      ];
                      const badgeClass = i < 3 ? rankColors[i] : 'bg-surface-container-high text-on-surface';
                      return (
                        <tr key={com.name} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 flex items-center gap-2">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${badgeClass}`}>
                              {i + 1}
                            </span>
                            <span className="font-bold text-on-surface">{com.name}</span>
                          </td>
                          <td className="py-3 text-center text-outline">{com.count}</td>
                          <td className="py-3 text-right text-primary font-bold">{com.amount.toLocaleString('fr-FR')} Dhs</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="3" className="py-8 text-center text-outline italic">Aucun collaborateur trouvé.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    );
  };

  // Helper pour générer le tracé SVG
  const getPathDataForSvg = (points, width, height, max) => {
    if (!points || points.length === 0) return '';
    const xStep = points.length > 1 ? width / (points.length - 1) : width;
    return points.map((p, i) => {
      const x = i * xStep;
      const y = max > 0 ? height - (Math.max(0, p.amount) / max * (height - 20)) - 10 : height - 10;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  };

  return (
    <Layout>
      <div className="px-4 md:px-10 py-8 max-w-7xl mx-auto space-y-8 text-left">
        {/* Toggle Onglets pour Administrateur */}
        {user?.role === 'Administrator' && (
          <div className="flex border-b border-outline-variant/30 gap-6 mb-2">
            <button
              onClick={() => setActiveTab('personal')}
              className={`pb-3 font-bold text-[15px] relative transition-all ${
                activeTab === 'personal' ? 'text-primary' : 'text-outline hover:text-on-surface'
              }`}
            >
              Mon Activité
              {activeTab === 'personal' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full animate-fade-in"></div>
              )}
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`pb-3 font-bold text-[15px] relative transition-all ${
                activeTab === 'stats' ? 'text-primary' : 'text-outline hover:text-on-surface'
              }`}
            >
              Statistiques Entreprise
              {activeTab === 'stats' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full animate-fade-in"></div>
              )}
            </button>
          </div>
        )}

        {activeTab === 'personal' ? (
          <>
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
              <h3 className="text-[24px] font-bold">{getCartTotal().toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Dhs</h3>
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
                            {order.totalAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Dhs
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
      </>
    ) : (
      renderStatsDashboard()
    )}
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
                        {order.totalAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Dhs
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
                            {line.quantity} x {line.unitPrice.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Dhs
                          </p>
                        </div>
                        <div className="text-right font-extrabold text-primary text-[14px] pt-1">
                          {(line.quantity * line.unitPrice).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Dhs
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Résumé financier */}
                <div className="p-5 bg-surface-container-low border-t border-outline-variant/30 text-[13px] space-y-2">
                  <div className="flex justify-between text-on-surface-variant">
                    <span>Montant HT</span>
                    <span className="font-bold">{selectedOrderDetail.totalAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Dhs</span>
                  </div>
                  <div className="flex justify-between text-on-surface-variant">
                    <span>TVA (20%)</span>
                    <span className="font-bold">{(selectedOrderDetail.totalAmount * 0.2).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Dhs</span>
                  </div>
                  <div className="flex justify-between text-primary font-extrabold text-[15px] border-t border-outline-variant/20 pt-2">
                    <span>Total TTC</span>
                    <span>{(selectedOrderDetail.totalAmount * 1.2).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Dhs</span>
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
                  <td className="p-3 border border-slate-300 text-right">{line.unitPrice.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Dhs</td>
                  <td className="p-3 border border-slate-300 text-right font-bold">{(line.quantity * line.unitPrice).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Dhs</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totaux financiers */}
          <div className="flex justify-end mb-12">
            <div className="w-64 space-y-2.5 text-[13px] bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex justify-between text-slate-600">
                <span>Total HT</span>
                <span className="font-bold">{selectedOrderDetail.totalAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Dhs</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>TVA (20%)</span>
                <span className="font-bold">{(selectedOrderDetail.totalAmount * 0.2).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Dhs</span>
              </div>
              <div className="flex justify-between text-slate-800 font-bold border-t border-slate-300 pt-2 text-[15px]">
                <span>Total TTC</span>
                <span>{(selectedOrderDetail.totalAmount * 1.2).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Dhs</span>
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
