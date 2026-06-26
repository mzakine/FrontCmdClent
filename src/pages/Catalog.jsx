import React, { useEffect, useState } from 'react';
import { useAuth, API_BASE_URL } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';

// Helper pour récupérer l'URL de l'image de l'article avec redimensionnement optimisé
export const getProductImageUrl = (imageUrl, width = 300) => {
  if (!imageUrl) {
    return 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80';
  }
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://') || imageUrl.startsWith('data:')) {
    return imageUrl;
  }
  return `${API_BASE_URL}/Catalog/image?path=${encodeURIComponent(imageUrl)}&width=${width}`;
};

export default function Catalog() {
  const { token, user, selectedClient, setSelectedClient } = useAuth();
  const { addToCart, getCartTotal } = useCart();
  
  // Products states
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState(null);
  
  const [displayMode, setDisplayMode] = useState('grid'); // 'grid' (with photo) or 'list' (detailed table)
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Toutes Familles');
  const [categories, setCategories] = useState(['Toutes Familles']);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(12);
  const [sortBy, setSortBy] = useState('default');
  const [quantities, setQuantities] = useState({});
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [familySearch, setFamilySearch] = useState('');

  
  const navigate = useNavigate();


  const [activeStockProduct, setActiveStockProduct] = useState(null);
  const [activeStockDetails, setActiveStockDetails] = useState(null);
  const [loadingStock, setLoadingStock] = useState(false);

  const fetchStockDetails = async (product) => {
    setActiveStockProduct(product);
    if (user?.role !== 'Administrator' && user?.role !== 'Commercial') {
      setActiveStockDetails(null);
      return;
    }
    setLoadingStock(true);
    try {
      const res = await fetch(`${API_BASE_URL}/Catalog/${encodeURIComponent(product.ref)}/stocks`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setActiveStockDetails(data);
      } else {
        throw new Error('Erreur de chargement');
      }
    } catch (err) {
      console.error(err);
      setActiveStockDetails([]);
    } finally {
      setLoadingStock(false);
    }
  };

  // Debounce search term to prevent excessive API queries
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Fetch products from server
  useEffect(() => {
    let active = true;
    
    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        
        let url = `${API_BASE_URL}/Catalog/products?page=${currentPage}&pageSize=${pageSize}&search=${encodeURIComponent(debouncedSearchTerm)}&category=${encodeURIComponent(selectedCategory)}&sortBy=${sortBy}`;
        if (selectedClient) {
          url += `&customerRef=${encodeURIComponent(selectedClient.ref)}`;
        }
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Erreur lors de la récupération du catalogue SAGE.');
        }
        
        const data = await response.json();
        
        if (!active) return;
        
        const fetchedProducts = data.products || [];
        setProducts(fetchedProducts);
        setTotalCount(data.totalCount || 0);
        
        if (data.categories) {
          setCategories(['Toutes Familles', ...data.categories]);
        }
        
        // Initialiser les quantités à 1
        const initialQtys = {};
        fetchedProducts.forEach(p => {
          initialQtys[p.ref] = 1;
        });
        setQuantities(initialQtys);
        
        setLoading(false);
      } catch (err) {
        if (active) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    if (token) {
      fetchProducts();
    }
    
    return () => {
      active = false;
    };
  }, [token, currentPage, debouncedSearchTerm, selectedCategory, sortBy, selectedClient]);

  const handleQtyChange = (ref, delta) => {
    const currentVal = quantities[ref] || 1;
    const current = parseFloat(currentVal.toString().replace(',', '.'));
    const next = current + delta;
    if (next < 0.01) return;
    setQuantities({
      ...quantities,
      [ref]: Math.round(next * 100) / 100
    });
  };

  const handleQtyInputChange = (ref, val) => {
    // Permettre uniquement les chiffres, virgule, point
    let cleaned = val.replace(/[^0-9,.]/g, '');
    cleaned = cleaned.replace(/\./g, ',');
    
    // S'assurer qu'il n'y a qu'une seule virgule
    const parts = cleaned.split(',');
    if (parts.length > 2) {
      cleaned = parts[0] + ',' + parts.slice(1).join('');
    }
    
    setQuantities({
      ...quantities,
      [ref]: cleaned
    });
  };

  const handleQtyInputBlur = (ref) => {
    const val = quantities[ref];
    if (val === undefined || val === null || val === '') {
      setQuantities({ ...quantities, [ref]: 1 });
      return;
    }
    
    const parsed = parseFloat(val.toString().replace(',', '.'));
    if (isNaN(parsed) || parsed <= 0) {
      setQuantities({ ...quantities, [ref]: 1 });
    } else {
      setQuantities({ ...quantities, [ref]: Math.round(parsed * 100) / 100 });
    }
  };

  const handleAddToCart = (product) => {
    const qtyVal = quantities[product.ref] || 1;
    const qty = parseFloat(qtyVal.toString().replace(',', '.'));
    if (isNaN(qty) || qty <= 0) return;
    addToCart(product, qty);
    
    // Réinitialiser la quantité à 1 après l'ajout au panier
    setQuantities({
      ...quantities,
      [product.ref]: 1
    });
  };

  // Helper pour surligner les correspondances de recherche
  const highlightText = (text, highlight) => {
    if (!highlight || !highlight.trim()) {
      return <span>{text}</span>;
    }
    const escapedHighlight = highlight.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${escapedHighlight})`, 'gi');
    const parts = text.split(regex);
    return (
      <span>
        {parts.map((part, i) => 
          regex.test(part) ? (
            <mark key={i} className="bg-amber-100 text-amber-900 rounded px-0.5 font-semibold">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  const handleCategoryChange = (cat) => {
    setSelectedCategory(cat);
    setCurrentPage(1);
  };

  const handleSortChange = (e) => {
    setSortBy(e.target.value);
    setCurrentPage(1);
  };

  // Les articles sont déjà triés et filtrés par le serveur
  const sortedProducts = products;
  
  const filteredCategories = categories.filter(cat => 
    cat.toLowerCase().includes(familySearch.toLowerCase())
  );

  return (

    <Layout>
      <div className="p-4 md:p-10 max-w-7xl mx-auto w-full space-y-6 text-left pb-32 lg:pb-10">
        {(user?.role === 'Administrator' || user?.role === 'Commercial') && selectedClient && (
          <div className="bg-secondary/15 border border-secondary/30 rounded-2xl p-4 flex items-center justify-between gap-3 text-secondary">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[24px]">person_search</span>
              <div>
                <p className="text-[14px] font-bold">Prise de commande active pour : <span className="underline">{selectedClient.name}</span></p>
                <p className="text-[12px] opacity-90">Code Client : <span className="font-mono font-bold">{selectedClient.ref}</span> • Les tarifs appliqués et restrictions de visibilité sont ceux négociés pour ce client dans SAGE.</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedClient(null)}
              className="text-[12px] font-bold bg-secondary text-white px-3 py-1.5 rounded-lg hover:opacity-90 active:scale-95 transition-all"
            >
              Réinitialiser
            </button>
          </div>
        )}

        {/* Banner Section */}
        <section className="relative overflow-hidden rounded-3xl bg-primary-container p-8 md:p-10 text-white shadow-lg">
          <div className="relative z-10">
            <h2 className="text-[32px] font-extrabold mb-3">Catalogue Produits</h2>
            <p className="text-[15px] text-on-primary-container max-w-xl">
              Accédez à l'ensemble de notre inventaire synchronisé en temps réel avec SAGE 100.
              {user?.role === 'Professional' && " Profitez de vos tarifs professionnels négociés (-20%)."}
              {(user?.role === 'Administrator' || user?.role === 'Commercial') && selectedClient && ` Affichage des tarifs négociés de ${selectedClient.name}.`}
            </p>
          </div>
        </section>

        {user?.role === 'Commercial' && !selectedClient ? (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-8 md:p-12 text-center max-w-xl mx-auto space-y-4 my-10 shadow-sm">
            <span className="material-symbols-outlined text-[64px] text-amber-500 animate-pulse">person_search</span>
            <h3 className="text-[20px] font-extrabold text-on-surface">Veuillez choisir un client</h3>
            <p className="text-[14px] text-on-surface-variant font-medium leading-relaxed">
              En tant que commercial, vous devez sélectionner le compte client au nom duquel vous souhaitez passer la commande ou créer un devis. Utilisez la barre de recherche client en haut à droite.
            </p>
          </div>
        ) : (
          <>
            {/* Status de synchronisation */}
            <div className="flex items-center justify-between text-outline text-[12px] bg-surface-container-lowest px-4 py-2.5 rounded-2xl border border-outline-variant/20 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-success-emerald"></span>
                <span className="font-semibold text-on-surface-variant">
                  Catalogue synchronisé en temps réel avec SAGE ({totalCount} articles au total)
                </span>
              </div>
            </div>

            {/* Nouveau conteneur principal avec Sidebar */}
            <div className="flex flex-col lg:flex-row gap-8 items-start w-full">
              
              {/* Barre Latérale des Catégories (PC uniquement) */}
              <aside className={`transition-all duration-300 flex-shrink-0 ${
                isSidebarCollapsed ? 'w-0 overflow-hidden opacity-0 p-0 border-0' : 'w-72'
              } hidden lg:flex flex-col gap-4 bg-white border border-outline-variant/30 rounded-3xl p-5 shadow-sm sticky top-24`}>
                <div className="flex justify-between items-center border-b border-outline-variant/20 pb-3">
                  <span className="font-extrabold text-[15px] text-primary">Familles d'articles</span>
                  <button 
                    onClick={() => setIsSidebarCollapsed(true)}
                    className="p-1 rounded-lg hover:bg-surface-variant/40 text-outline hover:text-on-surface flex items-center justify-center transition-colors"
                    title="Masquer la barre"
                  >
                    <span className="material-symbols-outlined text-[20px]">first_page</span>
                  </button>
                </div>
                
                {/* Recherche de famille */}
                <div className="relative w-full">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
                  <input
                    type="text"
                    value={familySearch}
                    onChange={(e) => setFamilySearch(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/40 rounded-xl py-2 pl-9 pr-8 text-[12px] font-medium outline-none focus:border-secondary transition-all"
                    placeholder="Filtrer les familles..."
                  />
                  {familySearch && (
                    <button 
                      onClick={() => setFamilySearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface flex items-center justify-center"
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  )}
                </div>
                
                {/* Liste des familles */}
                <div className="flex flex-col gap-1 max-h-[480px] overflow-y-auto custom-scrollbar pr-1">
                  {filteredCategories.map((cat) => {
                    const isSelected = selectedCategory === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => handleCategoryChange(cat)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all ${
                          isSelected
                            ? 'bg-secondary text-white shadow-sm'
                            : 'text-on-surface hover:bg-surface-container-high'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                  {filteredCategories.length === 0 && (
                    <p className="text-[12px] text-outline italic text-center py-4">Aucune famille trouvée</p>
                  )}
                </div>
              </aside>

              {/* Zone principale du catalogue */}
              <div className="flex-1 w-full space-y-6">
                
                {/* Barre d'outils supérieure */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-outline-variant/30 shadow-sm w-full">
                  <div className="flex items-center gap-3">
                    {/* Bouton pour réouvrir la sidebar sur PC */}
                    {isSidebarCollapsed && (
                      <button
                        onClick={() => setIsSidebarCollapsed(false)}
                        className="hidden lg:flex items-center gap-1.5 px-3 py-2 bg-secondary/10 hover:bg-secondary/20 text-secondary border border-secondary/30 rounded-xl transition-all font-bold text-[13px] animate-scale-up"
                        title="Afficher la barre"
                      >
                        <span className="material-symbols-outlined text-[18px]">last_page</span>
                        <span>Afficher Familles</span>
                      </button>
                    )}
                    
                    {/* Bouton de filtrage sur Mobile */}
                    <button
                      onClick={() => setIsMobileDrawerOpen(true)}
                      className="lg:hidden flex items-center gap-1.5 px-4 py-2.5 bg-secondary text-white rounded-full font-bold text-[13px] shadow-md shadow-secondary/15 active:scale-95 transition-all"
                    >
                      <span className="material-symbols-outlined text-[18px]">filter_list</span>
                      <span>Familles ({selectedCategory === 'Toutes Familles' ? 'Toutes' : selectedCategory})</span>
                    </button>
                    
                    {/* Badge de catégorie active sur PC */}
                    <span className="hidden lg:inline-block px-3.5 py-1.5 bg-surface-container-high text-on-surface-variant rounded-xl text-[12px] font-extrabold border border-outline-variant/20">
                      Famille active : <span className="text-primary font-black">{selectedCategory}</span>
                    </span>
                  </div>
                  
                  {/* Recherche interactive intégrée (Desktop) */}
                  <div className="relative flex-1 max-w-sm hidden md:block">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
                    <input 
                      className="w-full bg-surface-container-low border border-outline-variant/40 rounded-xl py-2 pl-9 pr-9 text-[13px] font-medium outline-none focus:border-secondary transition-all" 
                      placeholder="Rechercher une référence ou désignation..." 
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                      <button 
                        onClick={() => setSearchTerm('')} 
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface flex items-center justify-center p-0.5 rounded-full hover:bg-surface-variant/30"
                      >
                        <span className="material-symbols-outlined text-[15px]">close</span>
                      </button>
                    )}
                  </div>
                  
                  {/* Options de tri & de mode d'affichage */}
                  <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto">
                    {/* Toggle Mode d'affichage */}
                    <div className="flex items-center bg-surface-container-low p-1 rounded-xl border border-outline-variant/30">
                      <button
                        onClick={() => setDisplayMode('grid')}
                        className={`p-1.5 rounded-lg flex items-center justify-center transition-all ${
                          displayMode === 'grid'
                            ? 'bg-white text-secondary shadow-sm'
                            : 'text-outline hover:text-on-surface'
                        }`}
                        title="Affichage en Grille avec Photos"
                      >
                        <span className="material-symbols-outlined text-[18px]">grid_view</span>
                      </button>
                      <button
                        onClick={() => setDisplayMode('list')}
                        className={`p-1.5 rounded-lg flex items-center justify-center transition-all ${
                          displayMode === 'list'
                            ? 'bg-white text-secondary shadow-sm'
                            : 'text-outline hover:text-on-surface'
                        }`}
                        title="Affichage en Liste Détaillée"
                      >
                        <span className="material-symbols-outlined text-[18px]">table_rows</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <select 
                        value={sortBy}
                        onChange={handleSortChange}
                        className="bg-white border border-outline-variant rounded-lg px-2.5 py-1.5 text-[12px] font-bold focus:ring-2 focus:ring-secondary/20 focus:border-secondary outline-none cursor-pointer text-on-surface-variant"
                      >
                        <option value="default">Plus récents</option>
                        <option value="design-asc">Désignation (A-Z)</option>
                        <option value="design-desc">Désignation (Z-A)</option>
                        <option value="ref-asc">Référence (A-Z)</option>
                        <option value="ref-desc">Référence (Z-A)</option>
                        <option value="price-asc">Prix croissant</option>
                        <option value="price-desc">Prix décroissant</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Recherche interactive (Mobile) */}
                <div className="md:hidden relative w-full mb-4">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">search</span>
                  <input 
                    className="w-full bg-white border border-outline-variant rounded-full py-2.5 pl-10 pr-10 text-[14px] outline-none focus:border-secondary transition-all font-medium" 
                    placeholder="Rechercher un article..." 
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button 
                      onClick={() => setSearchTerm('')} 
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface flex items-center justify-center"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  )}
                </div>


        {/* Product Grid / List Table */}
        {loading ? (
          <div className="py-20 text-center text-outline w-full">
            <span className="material-symbols-outlined animate-spin text-5xl text-secondary">progress_activity</span>
            <p className="mt-4 font-semibold text-[15px]">Chargement initial du catalogue SAGE...</p>
          </div>
        ) : error ? (
          <div className="py-20 text-center text-error font-semibold w-full">
            {error}
          </div>
        ) : sortedProducts.length === 0 ? (
          <div className="py-20 text-center text-outline font-medium w-full bg-white rounded-3xl border border-outline-variant/30">
            Aucun produit ne correspond à votre recherche.
          </div>
        ) : displayMode === 'list' ? (
          /* MODE LISTE DETAILLEE */
          <div className="bg-white rounded-3xl border border-outline-variant/30 shadow-sm overflow-hidden text-left">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead className="bg-surface-container-low text-on-surface-variant uppercase text-[10px] tracking-widest font-bold border-b border-outline-variant/20">
                  <tr>
                    <th className="px-6 py-4">Référence</th>
                    <th className="px-6 py-4">Désignation</th>
                    <th className="px-6 py-4">Famille</th>
                    <th className="px-6 py-4">Stock</th>
                    <th className="px-6 py-4">Prix Unit.</th>
                    <th className="px-6 py-4 text-center" style={{ width: '130px' }}>Quantité</th>
                    <th className="px-6 py-4" style={{ width: '130px' }}>Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/25">
                  {sortedProducts.map((product) => {
                    const isPro = user?.role === 'Professional';
                    const hasDiscount = isPro && product.proPrice < product.publicPrice;
                    const price = isPro ? product.proPrice : product.publicPrice;
                    const qty = quantities[product.ref] || 1;
                    const isOutOfStock = product.stockQuantity <= 0;

                    return (
                      <tr 
                        key={product.ref} 
                        className="hover:bg-surface-container-lowest transition-colors group"
                      >
                        {/* REFERENCE */}
                        <td className="px-6 py-4 font-bold text-primary text-[14px]">
                          {highlightText(product.ref, searchTerm)}
                        </td>
                        
                        {/* NAME */}
                        <td className="px-6 py-4 max-w-sm truncate" title={product.name}>
                          <span 
                            className="font-semibold text-[14px] text-primary hover:underline cursor-pointer"
                            onClick={() => fetchStockDetails(product)}
                          >
                            {highlightText(product.name, searchTerm)}
                          </span>
                        </td>

                        
                        {/* CATEGORY */}
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 rounded-full bg-surface-variant/40 text-on-surface-variant text-[11px] font-bold">
                            {product.category || 'Général'}
                          </span>
                        </td>
                        
                        {/* STOCK STATUS */}
                        <td className="px-6 py-4 text-[13px] whitespace-nowrap">
                          <div 
                            onClick={() => fetchStockDetails(product)}
                            className="flex items-center gap-1.5 font-bold cursor-pointer hover:underline text-secondary"
                          >
                            <span className={`w-2 h-2 rounded-full ${
                              isOutOfStock ? 'bg-error' : product.status === 'COMMANDE SPÉCIALE' ? 'bg-secondary' : 'bg-success-emerald'
                            }`}></span>
                            <span className={
                              isOutOfStock
                                ? 'text-error/90'
                                : product.status === 'COMMANDE SPÉCIALE'
                                ? 'text-secondary'
                                : 'text-success-emerald'
                            }>
                              {isOutOfStock ? 'Rupture' : 'Disponible'}
                            </span>
                          </div>
                        </td>
                        
                        {/* PRICE */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-[15px] font-extrabold text-primary">
                              {price.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                            </span>
                            {hasDiscount && (
                              <span className="text-[10px] text-outline line-through">
                                {product.publicPrice.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                              </span>
                            )}
                          </div>
                        </td>
                        
                        {/* STEPPER QUANTITE */}
                        <td className="px-6 py-4">
                          <div className="flex items-center border border-outline-variant rounded-xl overflow-hidden h-9 bg-surface-container-lowest max-w-[100px] mx-auto">
                            <button 
                              onClick={() => handleQtyChange(product.ref, -1)}
                              disabled={parseFloat((quantities[product.ref] || 1).toString().replace(',', '.')) <= 1}
                              className="px-2 hover:bg-surface-container transition-colors h-full flex items-center justify-center disabled:opacity-40"
                            >
                              <span className="material-symbols-outlined text-[14px]">remove</span>
                            </button>
                            <input 
                              className="w-8 text-center border-none focus:ring-0 text-[13px] font-bold bg-transparent outline-none" 
                              type="text" 
                              value={qty.toString().replace('.', ',')} 
                              onChange={(e) => handleQtyInputChange(product.ref, e.target.value)}
                              onBlur={() => handleQtyInputBlur(product.ref)}
                            />
                            <button 
                              onClick={() => handleQtyChange(product.ref, 1)}
                              className="px-2 hover:bg-surface-container transition-colors h-full flex items-center justify-center"
                            >
                              <span className="material-symbols-outlined text-[14px]">add</span>
                            </button>
                          </div>
                        </td>
                        
                        {/* ACTION */}
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => handleAddToCart(product)}
                            className="w-full bg-secondary text-white rounded-xl h-9 text-[12px] font-bold flex items-center justify-center gap-1 active:scale-95 hover:bg-blue-700 transition-all shadow-sm shadow-secondary/15"
                          >
                            <span className="material-symbols-outlined text-[14px]">add_shopping_cart</span>
                            Ajouter
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="block md:hidden divide-y divide-outline-variant/20">
              {sortedProducts.map((product) => {
                const isPro = user?.role === 'Professional';
                const hasDiscount = isPro && product.proPrice < product.publicPrice;
                const price = isPro ? product.proPrice : product.publicPrice;
                const qty = quantities[product.ref] || 1;
                const isOutOfStock = product.stockQuantity <= 0;

                return (
                  <div key={product.ref} className="p-4 space-y-3">
                    {/* Reference & Category */}
                    <div className="flex justify-between items-center text-[12px]">
                      <span className="font-bold text-primary">{highlightText(product.ref, searchTerm)}</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-surface-variant/40 text-on-surface-variant text-[10px] font-bold">
                        {product.category || 'Général'}
                      </span>
                    </div>

                    {/* Product Name */}
                    <h4 className="text-[14px] line-clamp-2">
                      <span 
                        className="font-semibold text-primary hover:underline cursor-pointer"
                        onClick={() => fetchStockDetails(product)}
                      >
                        {highlightText(product.name, searchTerm)}
                      </span>
                    </h4>


                    {/* Stock Status & Price */}
                    <div className="flex justify-between items-center">
                      <div 
                        onClick={() => fetchStockDetails(product)}
                        className="flex items-center gap-1.5 text-[12px] font-bold cursor-pointer hover:underline text-secondary"
                      >
                        <span className={`w-2 h-2 rounded-full ${
                          isOutOfStock ? 'bg-error' : product.status === 'COMMANDE SPÉCIALE' ? 'bg-secondary' : 'bg-success-emerald'
                        }`}></span>
                        <span className={
                          isOutOfStock
                            ? 'text-error/90'
                            : product.status === 'COMMANDE SPÉCIALE'
                            ? 'text-secondary'
                            : 'text-success-emerald'
                        }>
                          {isOutOfStock ? 'Rupture' : 'Disponible'}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[15px] font-extrabold text-primary">
                          {price.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                        </span>
                        {hasDiscount && (
                          <span className="text-[10px] text-outline line-through block">
                            {product.publicPrice.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stepper & Action */}
                    <div className="flex items-center gap-3 pt-1">
                      <div className="flex items-center border border-outline-variant rounded-xl overflow-hidden h-9 bg-surface-container-lowest flex-1 max-w-[120px]">
                        <button 
                          onClick={() => handleQtyChange(product.ref, -1)}
                          disabled={parseFloat((quantities[product.ref] || 1).toString().replace(',', '.')) <= 1}
                          className="w-9 hover:bg-surface-container transition-colors h-full flex items-center justify-center disabled:opacity-40"
                        >
                          <span className="material-symbols-outlined text-[14px]">remove</span>
                        </button>
                        <input 
                          className="flex-1 text-center border-none focus:ring-0 text-[13px] font-bold bg-transparent outline-none" 
                          type="text" 
                          value={qty.toString().replace('.', ',')} 
                          onChange={(e) => handleQtyInputChange(product.ref, e.target.value)}
                          onBlur={() => handleQtyInputBlur(product.ref)}
                        />
                        <button 
                          onClick={() => handleQtyChange(product.ref, 1)}
                          className="w-9 hover:bg-surface-container transition-colors h-full flex items-center justify-center"
                        >
                          <span className="material-symbols-outlined text-[14px]">add</span>
                        </button>
                      </div>

                      <button 
                        onClick={() => handleAddToCart(product)}
                        className="flex-1 bg-secondary text-white rounded-xl h-9 text-[12px] font-bold flex items-center justify-center gap-1 active:scale-95 hover:bg-blue-700 transition-all shadow-sm shadow-secondary/15"
                      >
                        <span className="material-symbols-outlined text-[14px]">add_shopping_cart</span>
                        Ajouter
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* MODE GRILLE (Avec Photos) */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedProducts.map((product) => {
              const isPro = user?.role === 'Professional';
              const hasDiscount = isPro && product.proPrice < product.publicPrice;
              const price = isPro ? product.proPrice : product.publicPrice;
              const qty = quantities[product.ref] || 1;
              const isOutOfStock = product.stockQuantity <= 0;

              return (
                <div 
                  key={product.ref} 
                  className="group bg-white rounded-3xl p-4 shadow-sm border border-outline-variant/30 hover:border-secondary hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex flex-col"
                >
                  {/* Photo de l'article */}
                  <div 
                    onClick={() => fetchStockDetails(product)}
                    className="relative w-full h-44 rounded-2xl bg-surface-container-low mb-4 overflow-hidden cursor-pointer"
                  >
                    <img 
                      className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500" 
                      src={getProductImageUrl(product.imageUrl, 250)} 
                      alt={product.name} 
                    />
                    <div 
                      className={`absolute top-2 right-2 px-2.5 py-1 text-[10px] font-bold rounded-lg flex items-center gap-1 backdrop-blur-sm shadow-sm ${
                        isOutOfStock
                          ? 'bg-error/10 text-error'
                          : product.status === 'COMMANDE SPÉCIALE'
                          ? 'bg-secondary/10 text-secondary'
                          : 'bg-success-emerald/10 text-success-emerald'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        isOutOfStock ? 'bg-error' : product.status === 'COMMANDE SPÉCIALE' ? 'bg-secondary' : 'bg-success-emerald'
                      }`}></span>
                      {isOutOfStock ? 'RUPTURE STOCK' : product.status === 'COMMANDE SPÉCIALE' ? 'COMMANDE SPÉCIALE' : 'DISPONIBLE'}
                    </div>
                  </div>

                  {/* Détails de l'article */}
                  <div className="flex-1 flex flex-col justify-between text-left">
                    <div>
                      <p className="text-[11px] font-bold text-outline mb-1 uppercase tracking-widest">
                        REF: {highlightText(product.ref, searchTerm)}
                      </p>
                      <h3 
                        onClick={() => fetchStockDetails(product)}
                        className="text-[15px] font-bold text-primary hover:underline cursor-pointer mb-2 line-clamp-2 min-h-[44px]"
                      >
                        {highlightText(product.name, searchTerm)}
                      </h3>
                    </div>


                    <div className="space-y-1 mb-4">
                      {hasDiscount && (
                        <div className="flex items-baseline justify-between">
                          <span className="text-[11px] text-outline font-medium">Prix Public:</span>
                          <span className="text-[11px] text-outline line-through font-medium">
                            {product.publicPrice.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                          </span>
                        </div>
                      )}
                      <div className="flex items-baseline justify-between">
                        <span className={`text-[11px] font-bold ${hasDiscount ? 'text-secondary' : 'text-outline'}`}>
                          {isPro ? 'Prix Pro (SAGE):' : 'Prix Vente:'}
                        </span>
                        <span className="text-[19px] font-extrabold text-primary">
                          {price.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € {isPro ? 'HT' : 'TTC'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Stepper Quantité & Bouton Ajouter */}
                  <div className="flex items-center gap-2 mt-auto">
                    <div className="flex items-center border border-outline-variant rounded-xl overflow-hidden h-11 bg-surface-container-lowest">
                      <button 
                        onClick={() => handleQtyChange(product.ref, -1)}
                        disabled={parseFloat((quantities[product.ref] || 1).toString().replace(',', '.')) <= 1}
                        className="px-3 hover:bg-surface-container transition-colors h-full flex items-center justify-center disabled:opacity-40"
                      >
                        <span className="material-symbols-outlined text-[16px]">remove</span>
                      </button>
                      <input 
                        className="w-10 text-center border-none focus:ring-0 text-[14px] font-bold bg-transparent outline-none" 
                        type="text" 
                        value={qty.toString().replace('.', ',')} 
                        onChange={(e) => handleQtyInputChange(product.ref, e.target.value)}
                        onBlur={() => handleQtyInputBlur(product.ref)}
                      />
                      <button 
                        onClick={() => handleQtyChange(product.ref, 1)}
                        className="px-3 hover:bg-surface-container transition-colors h-full flex items-center justify-center"
                      >
                        <span className="material-symbols-outlined text-[16px]">add</span>
                      </button>
                    </div>

                    <button 
                      onClick={() => handleAddToCart(product)}
                      className="flex-1 bg-secondary text-white rounded-xl h-11 text-[14px] font-bold flex items-center justify-center gap-2 active:scale-95 hover:bg-blue-700 transition-all shadow-sm shadow-secondary/10"
                    >
                      <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
                      Ajouter
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Contrôles de Pagination */}
        {!loading && totalCount > pageSize && (
          <div className="flex flex-col sm:flex-row items-center justify-between border-t border-outline-variant/20 pt-6 mt-6 gap-4">
            <div className="text-[13px] text-outline font-semibold">
              Affichage de {((currentPage - 1) * pageSize) + 1} à {Math.min(currentPage * pageSize, totalCount)} sur {totalCount} articles
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-white border border-outline-variant rounded-xl text-[13px] font-semibold text-on-surface hover:bg-surface-variant/30 disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-1.5 shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                Précédent
              </button>
              
              <div className="hidden sm:flex items-center gap-1.5">
                {(() => {
                  const totalPages = Math.ceil(totalCount / pageSize);
                  let startPage = Math.max(1, currentPage - 2);
                  let endPage = Math.min(totalPages, startPage + 4);
                  if (endPage - startPage < 4) {
                    startPage = Math.max(1, endPage - 4);
                  }
                  const pages = [];
                  for (let p = startPage; p <= endPage; p++) {
                    pages.push(p);
                  }
                  return pages.map(pageNum => (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-9 h-9 rounded-xl text-[13px] font-bold transition-all ${
                        currentPage === pageNum
                          ? 'bg-secondary text-white shadow-sm'
                          : 'bg-white border border-outline-variant text-on-surface hover:bg-surface-variant/30'
                      }`}
                    >
                      {pageNum}
                    </button>
                  ));
                })()}
              </div>

              <div className="sm:hidden text-[13px] font-bold text-on-surface px-2">
                Page {currentPage} / {Math.ceil(totalCount / pageSize)}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(totalCount / pageSize)))}
                disabled={currentPage === Math.ceil(totalCount / pageSize)}
                className="px-4 py-2 bg-white border border-outline-variant rounded-xl text-[13px] font-semibold text-on-surface hover:bg-surface-variant/30 disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-1.5 shadow-sm"
              >
                Suivant
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}
              </div>
            </div>
            
            {/* Tiroir coulissant mobile (Bottom Sheet) */}
            {isMobileDrawerOpen && (
              <div className="fixed inset-0 z-[250] lg:hidden flex items-end justify-center bg-black/60 backdrop-blur-sm">
                <div className="bg-white rounded-t-[32px] w-full max-h-[85vh] flex flex-col shadow-2xl border-t border-outline-variant/30 animate-slide-up">
                  {/* Indicateur visuel de glissement */}
                  <div className="w-12 h-1 bg-outline-variant/40 rounded-full mx-auto my-3 flex-shrink-0"></div>
                  
                  <div className="flex justify-between items-center px-6 pb-4 border-b border-outline-variant/20">
                    <div>
                      <h3 className="font-extrabold text-[16px] text-primary">Sélectionner une Famille</h3>
                      <p className="text-[11px] text-outline font-semibold uppercase mt-0.5">Filtrage du catalogue</p>
                    </div>
                    <button
                      onClick={() => setIsMobileDrawerOpen(false)}
                      className="p-1.5 rounded-full hover:bg-surface-variant/40 text-outline hover:text-on-surface"
                    >
                      <span className="material-symbols-outlined text-[22px]">close</span>
                    </button>
                  </div>
                  
                  {/* Recherche interne au tiroir */}
                  <div className="p-4 border-b border-outline-variant/20 bg-surface-container-low">
                    <div className="relative w-full">
                      <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline">search</span>
                      <input
                        type="text"
                        value={familySearch}
                        onChange={(e) => setFamilySearch(e.target.value)}
                        className="w-full bg-white border border-outline-variant rounded-2xl py-3 pl-10 pr-10 text-[14px] font-semibold outline-none focus:border-secondary transition-all"
                        placeholder="Rechercher une famille..."
                      />
                      {familySearch && (
                        <button 
                          onClick={() => setFamilySearch('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface flex items-center justify-center p-0.5 rounded-full hover:bg-surface-variant/40"
                        >
                          <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Liste défilante des familles */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-1.5 custom-scrollbar min-h-[250px]">
                    {filteredCategories.map((cat) => {
                      const isSelected = selectedCategory === cat;
                      return (
                        <button
                          key={cat}
                          onClick={() => {
                            handleCategoryChange(cat);
                            setIsMobileDrawerOpen(false);
                          }}
                          className={`w-full text-left px-4 py-3 rounded-2xl text-[14px] font-bold flex justify-between items-center transition-all ${
                            isSelected
                              ? 'bg-secondary text-white shadow-md shadow-secondary/15'
                              : 'text-on-surface hover:bg-surface-container-high'
                          }`}
                        >
                          <span>{cat}</span>
                          {isSelected && <span className="material-symbols-outlined text-[18px]">check_circle</span>}
                        </button>
                      );
                    })}
                    {filteredCategories.length === 0 && (
                      <p className="text-[13px] text-outline italic text-center py-10 font-medium">Aucune famille ne correspond</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}


        {/* Modal Répartition Stock par Dépôt */}
        {activeStockProduct && (() => {
          const isProPricing = user?.role === 'Professional' || 
            ((user?.role === 'Administrator' || user?.role === 'Commercial') && 
             selectedClient && 
             !selectedClient.ref.toLowerCase().includes('comptoir') && 
             selectedClient.ref !== 'CLIENT_PARTICULIER');
          const hasDiscount = isProPricing && activeStockProduct.proPrice < activeStockProduct.publicPrice;
          const finalPrice = isProPricing ? activeStockProduct.proPrice : activeStockProduct.publicPrice;
          const qty = quantities[activeStockProduct.ref] || 1;
          const isOutOfStock = activeStockProduct.stockQuantity <= 0;
          const showDetailedStock = user?.role === 'Administrator' || user?.role === 'Commercial';

          return (
            <div className="fixed inset-0 bg-black/65 backdrop-blur-md z-[200] flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-white rounded-[32px] w-full max-w-3xl shadow-2xl border border-outline-variant/30 overflow-hidden animate-scale-up flex flex-col my-8 max-h-[90vh]">
                
                {/* Header */}
                <div className="flex justify-between items-center px-8 py-5 border-b border-outline-variant/20 bg-surface-container-lowest">
                  <div>
                    <span className="px-3 py-1 rounded-full bg-secondary/10 text-secondary text-[11px] font-extrabold uppercase tracking-wider">
                      Fiche Article
                    </span>
                  </div>
                  <button
                    onClick={() => { setActiveStockProduct(null); setActiveStockDetails(null); }}
                    className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-variant/40 text-outline hover:text-on-surface transition-all"
                  >
                    <span className="material-symbols-outlined text-[24px]">close</span>
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    
                    {/* Left Column: Product Image */}
                    <div className="flex flex-col gap-4">
                      <div className="w-full aspect-square rounded-2xl bg-surface-container-low border border-outline-variant/25 overflow-hidden flex items-center justify-center relative">
                        <img
                          className="w-full h-full object-cover"
                          src={getProductImageUrl(activeStockProduct.imageUrl, 500)}
                          alt={activeStockProduct.name}
                        />
                        <div className={`absolute top-3 right-3 px-3 py-1.5 text-[10px] font-bold rounded-lg flex items-center gap-1.5 backdrop-blur-md shadow-sm border ${
                          isOutOfStock
                            ? 'bg-error/10 text-error border-error/20'
                            : activeStockProduct.status === 'COMMANDE SPÉCIALE'
                            ? 'bg-secondary/10 text-secondary border-secondary/20'
                            : 'bg-success-emerald/10 text-success-emerald border-success-emerald/20'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            isOutOfStock ? 'bg-error' : activeStockProduct.status === 'COMMANDE SPÉCIALE' ? 'bg-secondary' : 'bg-success-emerald'
                          }`}></span>
                          {isOutOfStock ? 'RUPTURE STOCK' : activeStockProduct.status === 'COMMANDE SPÉCIALE' ? 'COMMANDE SPÉCIALE' : 'DISPONIBLE'}
                        </div>
                      </div>
                      
                      {activeStockProduct.category && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-surface-container-high rounded-xl text-on-surface-variant text-[12px] font-bold">
                          <span className="material-symbols-outlined text-[16px] text-outline">folder</span>
                          <span>Famille: {activeStockProduct.category}</span>
                        </div>
                      )}
                    </div>

                    {/* Right Column: Description, Price, Stepper, Actions & Stock */}
                    <div className="flex flex-col justify-between text-left space-y-6">
                      <div className="space-y-2">
                        <p className="text-[12px] font-bold text-outline uppercase tracking-wider font-mono">
                          Référence: {activeStockProduct.ref}
                        </p>
                        <h3 className="text-[20px] md:text-[24px] font-black text-primary leading-tight">
                          {activeStockProduct.name}
                        </h3>
                      </div>

                      {/* Pricing Section */}
                      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[13px] text-outline font-semibold">
                            {isProPricing ? 'Tarif Professionnel HT' : 'Tarif Vente Public HT'}
                          </span>
                          <span className="text-2xl font-black text-primary">
                            {finalPrice.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                          </span>
                        </div>
                        {hasDiscount && (
                          <div className="flex justify-between items-center text-[12px] border-t border-outline-variant/20 pt-2 mt-2">
                            <span className="text-outline font-medium">Prix Public Conseillé:</span>
                            <div className="flex items-center gap-2">
                              <span className="line-through text-outline">
                                {activeStockProduct.publicPrice.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-secondary/15 text-secondary text-[10px] font-black">
                                Prix Négocié
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Add to Cart Controls */}
                      <div className="space-y-3">
                        <p className="text-[12px] font-extrabold text-outline uppercase tracking-wider">Quantité à commander</p>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center border border-outline-variant rounded-xl overflow-hidden h-12 bg-surface-container-lowest flex-1 max-w-[140px]">
                            <button
                              onClick={() => handleQtyChange(activeStockProduct.ref, -1)}
                              disabled={parseFloat(qty.toString().replace(',', '.')) <= 1}
                              className="px-3.5 hover:bg-surface-container transition-colors h-full flex items-center justify-center disabled:opacity-40"
                            >
                              <span className="material-symbols-outlined text-[18px]">remove</span>
                            </button>
                            <input
                              className="w-12 text-center border-none focus:ring-0 text-[15px] font-extrabold bg-transparent outline-none"
                              type="text"
                              value={qty.toString().replace('.', ',')}
                              onChange={(e) => handleQtyInputChange(activeStockProduct.ref, e.target.value)}
                              onBlur={() => handleQtyInputBlur(activeStockProduct.ref)}
                            />
                            <button
                              onClick={() => handleQtyChange(activeStockProduct.ref, 1)}
                              className="px-3.5 hover:bg-surface-container transition-colors h-full flex items-center justify-center"
                            >
                              <span className="material-symbols-outlined text-[18px]">add</span>
                            </button>
                          </div>

                          <button
                            onClick={() => {
                              handleAddToCart(activeStockProduct);
                              setActiveStockProduct(null);
                              setActiveStockDetails(null);
                            }}
                            className="flex-1 bg-secondary text-white rounded-xl h-12 text-[14px] font-extrabold flex items-center justify-center gap-2 active:scale-95 hover:bg-blue-700 transition-all shadow-md shadow-secondary/15"
                          >
                            <span className="material-symbols-outlined text-[20px]">add_shopping_cart</span>
                            Ajouter au panier
                          </button>
                        </div>
                      </div>

                      {/* Stock Section */}
                      <div className="border-t border-outline-variant/20 pt-4 mt-2">
                        {showDetailedStock ? (
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-[12px] font-extrabold text-outline uppercase tracking-wider">Stocks par dépôt SAGE</span>
                              {loadingStock && (
                                <span className="material-symbols-outlined animate-spin text-[16px] text-secondary">progress_activity</span>
                              )}
                            </div>
                            {loadingStock ? (
                              <div className="py-6 text-center bg-surface-container rounded-2xl border border-outline-variant/10">
                                <span className="material-symbols-outlined animate-spin text-2xl text-secondary">progress_activity</span>
                                <p className="text-[11px] text-outline mt-1.5 font-semibold">Chargement des dépôts...</p>
                              </div>
                            ) : activeStockDetails && activeStockDetails.length > 0 ? (
                              <div className="space-y-2">
                                <div className="divide-y divide-outline-variant/20 border border-outline-variant/20 rounded-2xl overflow-hidden max-h-[160px] overflow-y-auto custom-scrollbar">
                                  {activeStockDetails.map((w, index) => (
                                    <div key={index} className="flex justify-between items-center px-4 py-2.5 bg-surface-container-lowest hover:bg-surface-container-low transition-colors">
                                      <span className="text-[13px] font-semibold text-on-surface-variant">{w.warehouseName}</span>
                                      <span className={`text-[13px] font-bold ${w.quantity > 0 ? 'text-success-emerald' : 'text-outline'}`}>
                                        {w.quantity.toLocaleString('fr-FR')} pce
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                <div className="flex justify-between items-center px-4 py-2.5 bg-secondary/5 rounded-2xl border border-secondary/20">
                                  <span className="text-[13px] font-extrabold text-secondary">Total Stock SAGE</span>
                                  <span className="text-[13px] font-black text-secondary">
                                    {activeStockDetails.reduce((sum, item) => sum + item.quantity, 0).toLocaleString('fr-FR')} pce
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="py-4 text-center text-outline text-[12px] font-semibold bg-surface-container rounded-2xl border border-outline-variant/20">
                                Aucun stock disponible par dépôt.
                              </div>
                            )}
                          </div>
                        ) : (
                          // Simplified stock display for Professional and Individual users
                          <div className="space-y-2">
                            <span className="text-[12px] font-extrabold text-outline uppercase tracking-wider block">Disponibilité</span>
                            <div className={`flex items-center gap-3 p-3.5 rounded-2xl border ${
                              isOutOfStock 
                                ? 'bg-error/5 text-error border-error/20' 
                                : 'bg-success-emerald/5 text-success-emerald border-success-emerald/20'
                            }`}>
                              <span className={`w-3 h-3 rounded-full animate-pulse ${isOutOfStock ? 'bg-error' : 'bg-success-emerald'}`}></span>
                              <div className="text-left">
                                <p className="text-[13px] font-extrabold">
                                  {isOutOfStock ? 'Rupture de stock' : 'Disponible immédiatement'}
                                </p>
                                <p className="text-[11px] opacity-80 font-medium">
                                  {isOutOfStock 
                                    ? 'Cet article est momentanément indisponible.' 
                                    : 'Article en stock dans nos entrepôts centraux. Expédition sous 24/48h.'}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="px-8 py-4 border-t border-outline-variant/20 bg-surface-container-lowest flex justify-end gap-3">
                  <button
                    onClick={() => { setActiveStockProduct(null); setActiveStockDetails(null); }}
                    className="px-5 py-2.5 bg-surface-container border border-outline-variant rounded-xl text-[13px] font-bold text-on-surface hover:bg-surface-variant/40 transition-all active:scale-95"
                  >
                    Fermer
                  </button>
                </div>

              </div>
            </div>
          );
        })()}

        {/* Barre flottante de commande (Mobile uniquement) */}
        {getCartTotal() > 0 && (
          <div className="fixed bottom-20 left-4 right-4 lg:hidden bg-sage-blue-gradient-start text-white p-4 rounded-3xl shadow-2xl flex items-center justify-between z-40 border border-white/10">
            <div className="text-left">
              <p className="text-[10px] text-on-primary-container uppercase font-bold tracking-widest">Panier Actuel</p>
              <p className="text-[20px] font-bold">{getCartTotal().toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € HT</p>
            </div>
            <button 
              onClick={() => navigate('/cart')}
              className="bg-secondary hover:bg-blue-700 px-6 py-2.5 rounded-2xl font-bold text-[14px] flex items-center gap-2 shadow-md active:scale-95 transition-all"
            >
              <span>Valider</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
