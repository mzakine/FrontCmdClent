import React, { useEffect, useState } from 'react';
import { useAuth, API_BASE_URL } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { getProductImageUrl } from './Catalog';

export default function Cart() {
  const { token, user, selectedClient } = useAuth();
  const { cartItems, updateQuantity, removeFromCart, getCartTotal, clearCart } = useCart();
  const [typedQtys, setTypedQtys] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);
  const [successOrder, setSuccessOrder] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [collaborators, setCollaborators] = useState([]);
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState('');
  
  const navigate = useNavigate();

  useEffect(() => {
    if (token && user?.role === 'Commercial') {
      fetch(`${API_BASE_URL}/Order/collaborators`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => {
        if (!res.ok) throw new Error('Erreur de chargement des collaborateurs');
        return res.json();
      })
      .then(data => {
        setCollaborators(data);
        if (user.sageCollaboratorId) {
          setSelectedCollaboratorId(user.sageCollaboratorId.toString());
        } else if (data.length > 0) {
          setSelectedCollaboratorId(data[0].id.toString());
        }
      })
      .catch(err => console.error(err));
    }
  }, [token, user]);

  const handleQtyChange = (ref, currentQty, delta) => {
    const next = currentQty + delta;
    if (next < 0.01) return;
    updateQuantity(ref, Math.round(next * 100) / 100);
  };

  const handleQtyInputChange = (ref, val) => {
    let cleaned = val.replace(/[^0-9,.]/g, '');
    cleaned = cleaned.replace(/\./g, ',');
    
    const parts = cleaned.split(',');
    if (parts.length > 2) {
      cleaned = parts[0] + ',' + parts.slice(1).join('');
    }
    
    setTypedQtys({
      ...typedQtys,
      [ref]: cleaned
    });
  };

  const handleQtyInputBlur = (ref, fallbackQty) => {
    const val = typedQtys[ref];
    if (val === undefined || val === null || val === '') {
      setTypedQtys(prev => {
        const next = { ...prev };
        delete next[ref];
        return next;
      });
      return;
    }
    
    const parsed = parseFloat(val.toString().replace(',', '.'));
    if (isNaN(parsed) || parsed <= 0) {
      updateQuantity(ref, fallbackQty);
    } else {
      updateQuantity(ref, Math.round(parsed * 100) / 100);
    }
    
    setTypedQtys(prev => {
      const next = { ...prev };
      delete next[ref];
      return next;
    });
  };

  const handleCheckout = async (checkoutType = 'order') => {
    if (cartItems.length === 0) return;

    setSubmitLoading(true);

    try {
      const orderPayload = {
        items: cartItems.map(item => ({
          productRef: item.ref,
          quantity: item.quantity
        })),
        deliveryAddressName: "",
        deliveryStreet: "",
        deliveryCity: "",
        customerRef: selectedClient ? selectedClient.ref : null,
        collaboratorId: selectedCollaboratorId ? parseInt(selectedCollaboratorId) : null
      };

      let endpoint = 'submit';
      if (checkoutType === 'quote') {
        endpoint = 'submit-quote';
      } else if (checkoutType === 'purchaseRequest') {
        endpoint = 'submit-purchase-request';
      }

      const response = await fetch(`${API_BASE_URL}/Order/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(orderPayload)
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Erreur lors de la validation du panier.');
      }

      const createdOrder = await response.json();
      setSuccessOrder({ ...createdOrder, checkoutType });
      setShowModal(true);
      clearCart();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const totalHT = getCartTotal();
  const tva = totalHT * 0.20;
  const totalTTC = totalHT + tva;

  return (
    <Layout>
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-10 py-8 text-left pb-28 lg:pb-10">
        {cartItems.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-3xl border border-outline-variant/30 custom-shadow max-w-md mx-auto space-y-6">
            <div className="w-20 h-20 bg-secondary/10 text-secondary rounded-full flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[40px]">shopping_cart</span>
            </div>
            <div className="space-y-2">
              <h3 className="text-[20px] font-bold text-primary">Votre panier est vide</h3>
              <p className="text-on-surface-variant text-[14px]">Parcourez le catalogue pour ajouter des articles.</p>
            </div>
            <button 
              onClick={() => navigate('/catalog')}
              className="bg-primary text-on-primary px-6 py-3 rounded-2xl font-bold shadow-md hover:bg-slate-800 transition-all"
            >
              Retourner au catalogue
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Items List & Address */}
            <div className="lg:col-span-8 space-y-6">
              {/* Items Card */}
              <div className="bg-white rounded-3xl shadow-sm border border-outline-variant/30 overflow-hidden">
                <div className="px-6 py-4 border-b border-outline-variant/30 flex justify-between items-center bg-surface-container-low/20">
                  <h3 className="text-[18px] font-bold text-primary">Articles du Panier</h3>
                  <span className="text-[14px] font-semibold text-outline">{cartItems.length} références</span>
                </div>
                
                <ul className="divide-y divide-outline-variant/20">
                  {cartItems.map((item) => (
                    <li key={item.ref} className="p-6 flex flex-col md:flex-row gap-4 hover:bg-surface/30 transition-colors">
                      <div className="w-24 h-24 bg-surface rounded-2xl flex-shrink-0 overflow-hidden border border-outline-variant/30">
                        <img className="w-full h-full object-cover" src={getProductImageUrl(item.imageUrl, 120)} alt={item.name} />
                      </div>
                      
                      <div className="flex-1 flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="text-[16px] font-bold text-primary line-clamp-1">{item.name}</h4>
                            <p className="text-[12px] text-outline font-semibold uppercase tracking-wider">
                              REF: {item.ref}
                            </p>
                          </div>
                          <button 
                            onClick={() => removeFromCart(item.ref)}
                            className="text-outline hover:text-error transition-colors p-1"
                          >
                            <span className="material-symbols-outlined text-[20px]">delete</span>
                          </button>
                        </div>
                        
                        <div className="mt-4 flex items-center justify-between">
                          <div className="flex items-center bg-surface border border-outline-variant/30 rounded-xl p-1">
                             <button 
                               onClick={() => handleQtyChange(item.ref, item.quantity, -1)}
                               disabled={item.quantity <= 1}
                               className="w-8 h-8 flex items-center justify-center hover:bg-surface-variant/50 rounded-lg transition-all disabled:opacity-40"
                             >
                               <span className="material-symbols-outlined text-[16px]">remove</span>
                             </button>
                             <input 
                               className="w-12 text-center bg-transparent border-none focus:ring-0 font-bold text-[14px] outline-none" 
                               type="text" 
                               value={typedQtys[item.ref] !== undefined ? typedQtys[item.ref] : item.quantity.toString().replace('.', ',')} 
                               onChange={(e) => handleQtyInputChange(item.ref, e.target.value)}
                               onBlur={() => handleQtyInputBlur(item.ref, item.quantity)}
                             />
                             <button 
                               onClick={() => handleQtyChange(item.ref, item.quantity, 1)}
                               className="w-8 h-8 flex items-center justify-center hover:bg-surface-variant/50 rounded-lg transition-all"
                             >
                               <span className="material-symbols-outlined text-[16px]">add</span>
                             </button>
                          </div>
                          
                          <div className="text-right">
                            <p className="text-[12px] text-outline">Unitaire: {item.price.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</p>
                            <p className="text-[16px] font-bold text-secondary">
                              {(item.price * item.quantity).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                            </p>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                
                <div className="p-4 bg-surface-container-high/20 text-center border-t border-outline-variant/20">
                  <button 
                    onClick={() => navigate('/catalog')}
                    className="text-secondary font-bold hover:underline flex items-center justify-center gap-2 mx-auto text-[14px]"
                  >
                    <span className="material-symbols-outlined text-[18px]">add_circle</span>
                    Ajouter un autre article
                  </button>
                </div>
              </div>


            </div>

            {/* Right Column: Order Summary */}
            <div className="lg:col-span-4">
              <div className="bg-white rounded-3xl shadow-lg border border-outline-variant/30 p-6 sticky top-28 text-left">
                <h3 className="text-[18px] font-bold text-primary mb-6">Récapitulatif</h3>
                
                {(user?.role === 'Administrator' || user?.role === 'Commercial') && (
                  <div className="mb-6 p-4 bg-secondary/10 rounded-2xl border border-secondary/20 space-y-4">
                    <div>
                      <p className="text-[12px] font-bold text-secondary uppercase tracking-wider">Client Destinataire</p>
                      <p className="text-[14px] font-bold text-primary mt-1">
                        {selectedClient ? selectedClient.name : (user?.role === 'Commercial' ? 'Aucun client sélectionné' : 'SAGE par défaut')}
                      </p>
                      {selectedClient && (
                        <p className="text-[11px] text-outline font-semibold">
                          Code: {selectedClient.ref}
                        </p>
                      )}
                    </div>

                    {user?.role === 'Commercial' && collaborators.length > 0 && (
                      <div className="pt-3 border-t border-secondary/20">
                        <label className="block text-[11px] font-bold text-secondary uppercase tracking-wider mb-1.5">
                          Représentant Associé
                        </label>
                        <select
                          className="w-full h-10 px-2.5 bg-white rounded-xl border border-outline-variant/30 text-[13px] font-semibold text-primary outline-none focus:border-secondary transition-all"
                          value={selectedCollaboratorId}
                          onChange={(e) => setSelectedCollaboratorId(e.target.value)}
                        >
                          {collaborators.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.function || 'Commercial'})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-[14px] font-medium">
                    <span className="text-on-surface-variant">Sous-total HT</span>
                    <span className="text-primary">{totalHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                  </div>
                  <div className="flex justify-between items-center text-[14px] font-medium">
                    <span className="text-on-surface-variant">Livraison</span>
                    <span className="text-success-emerald font-bold">Gratuit</span>
                  </div>
                  <div className="flex justify-between items-center text-[14px] font-medium">
                    <span className="text-on-surface-variant">TVA (20%)</span>
                    <span className="text-primary">{tva.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                  </div>
                  
                  <div className="pt-4 border-t border-outline-variant/30 flex justify-between items-end">
                    <div>
                      <p className="text-[12px] font-bold text-primary uppercase tracking-wider">TOTAL TTC</p>
                      <p className="text-[11px] text-outline italic">Prêt pour SAGE 100</p>
                    </div>
                    <p className="text-[24px] font-black text-secondary">
                      {totalTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                    </p>
                  </div>
                </div>
                
                <div className="mt-8 space-y-4">
                  {user?.role === 'Commercial' ? (
                    <>
                      <button 
                        onClick={() => handleCheckout('order')}
                        disabled={submitLoading || !selectedClient}
                        className="w-full h-14 bg-secondary text-on-secondary rounded-2xl font-bold text-[15px] shadow-md hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-55"
                      >
                        {submitLoading ? (
                          <>
                            <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                            <span>Synchronisation...</span>
                          </>
                        ) : (
                          <>
                            <span>Valider en Bon de Commande</span>
                            <span className="material-symbols-outlined">description</span>
                          </>
                        )}
                      </button>

                      <button 
                        onClick={() => handleCheckout('quote')}
                        disabled={submitLoading || !selectedClient}
                        className="w-full h-14 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-bold text-[15px] shadow-md active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-55"
                      >
                        {submitLoading ? (
                          <>
                            <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                            <span>Création Devis...</span>
                          </>
                        ) : (
                          <>
                            <span>Créer un Devis</span>
                            <span className="material-symbols-outlined">assignment</span>
                          </>
                        )}
                      </button>

                      <button 
                        onClick={() => handleCheckout('purchaseRequest')}
                        disabled={submitLoading || !selectedClient}
                        className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-[15px] shadow-md active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-55"
                      >
                        {submitLoading ? (
                          <>
                            <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                            <span>Création Demande d'Achat...</span>
                          </>
                        ) : (
                          <>
                            <span>Créer Demande d'Achat</span>
                            <span className="material-symbols-outlined">shopping_bag</span>
                          </>
                        )}
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={() => handleCheckout(false)}
                      disabled={submitLoading}
                      className="w-full h-14 bg-secondary text-on-secondary rounded-2xl font-bold text-[16px] shadow-md hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-55"
                    >
                      {submitLoading ? (
                        <>
                          <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                          <span>Synchronisation SAGE...</span>
                        </>
                      ) : (
                        <>
                          <span>Valider la Commande</span>
                          <span className="material-symbols-outlined">arrow_forward</span>
                        </>
                      )}
                    </button>
                  )}
                  
                  <p className="text-center text-[12px] text-outline px-4 font-medium leading-relaxed">
                    {user?.role === 'Commercial'
                      ? "Un document de vente (devis ou commande) sera créé instantanément dans SAGE pour le client sélectionné."
                      : <>En validant, un document <span className="font-bold text-primary">BoCmdVente</span> sera créé instantanément dans votre instance SAGE.</>
                    }
                  </p>
                </div>
                
                {/* Decorative Banner */}
                <div className="mt-8 p-4 bg-secondary/5 rounded-2xl border border-secondary/20 flex gap-4 items-center">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm text-secondary flex-shrink-0">
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                      insights
                    </span>
                  </div>
                  <div>
                    <p className="text-[12px] font-bold text-primary">Analyse des Stocks</p>
                    <p className="text-[11px] text-outline font-medium">Livraison estimée : 48-72h ouvrées.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Success Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300">
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full mx-4 text-center transform transition-transform duration-300 scale-100 border border-outline-variant/30">
            <div className="w-20 h-20 bg-success-emerald/10 text-success-emerald rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-[48px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                check_circle
              </span>
            </div>
            <h4 className="text-[20px] font-bold text-primary mb-2">
              {successOrder?.checkoutType === 'quote' 
                ? 'Devis Créé !' 
                : successOrder?.checkoutType === 'purchaseRequest' 
                  ? 'Demande d\'Achat Créée !' 
                  : 'Commande Validée !'}
            </h4>
            <p className="text-[14px] text-outline font-medium mb-6 leading-relaxed">
              {successOrder?.checkoutType === 'quote' ? (
                <>Le devis <span className="font-bold text-primary">{successOrder?.sageOrderRef}</span> a été généré avec succès dans SAGE 100.</>
              ) : successOrder?.checkoutType === 'purchaseRequest' ? (
                <>La demande d'achat <span className="font-bold text-primary">{successOrder?.sageOrderRef}</span> a été générée avec succès dans SAGE 100.</>
              ) : (
                <>La pièce de vente <span className="font-bold text-primary">BoCmdVente {successOrder?.sageOrderRef}</span> a été générée avec succès dans SAGE 100.</>
              )}
            </p>
            <button 
              onClick={() => {
                setShowModal(false);
                navigate('/catalog');
              }}
              className="w-full py-3.5 bg-primary text-on-primary rounded-2xl font-bold hover:bg-slate-800 transition-colors active:scale-98"
            >
              Retour au catalogue
            </button>
          </div>
        </div>
      )}


    </Layout>
  );
}
