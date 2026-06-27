import React, { useState, useEffect, useRef } from 'react';
import { useAuth, API_BASE_URL } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';

export default function ImportDocument() {
  const { token, user, selectedClient, setSelectedClient } = useAuth();
  const navigate = useNavigate();

  // Wizard Steps: 1 (Upload), 2 (Review), 3 (Confirm)
  const [step, setStep] = useState(1);
  const [error, setError] = useState(null);
  
  // Client selection
  const [clients, setClients] = useState([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const clientDropdownRef = useRef(null);

  // File Upload states
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);

  // Extraction & Validation results
  const [extractedData, setExtractedData] = useState({
    clientNom: null,
    clientRefExterne: null,
    dateDocument: null,
    lignes: [],
    fileHash: '',
    fileName: ''
  });
  
  // Search article states
  const [searchResults, setSearchResults] = useState({}); // rowId -> array of products
  const [searchQueries, setSearchQueries] = useState({}); // rowId -> search string
  const [searchLoading, setSearchLoading] = useState({}); // rowId -> bool

  // Final Order placement states
  const [submitLoading, setSubmitLoading] = useState(false);
  const [successOrder, setSuccessOrder] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Fetch client list
  useEffect(() => {
    if (user?.role === 'Administrator' && token) {
      fetch(`${API_BASE_URL}/Catalog/clients`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setClients(data); })
      .catch(err => console.error("Erreur de chargement des clients:", err));
    }
  }, [user, token]);

  // Click outside listener for client dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(event.target)) {
        setShowClientDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    setError(null);
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      processFile(droppedFiles[0]);
    }
  };

  const handleFileChange = (e) => {
    setError(null);
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (selectedFile) => {
    const ext = selectedFile.name.split('.').pop().toLowerCase();
    const supported = ["pdf", "jpg", "jpeg", "png", "webp"];
    if (!supported.includes(ext)) {
      setError(`Format non supporté. Formats autorisés : ${supported.join(', ')}.`);
      return;
    }

    setFile(selectedFile);
    setFileName(selectedFile.name);

    // Create file preview URL
    if (ext !== 'pdf') {
      const url = URL.createObjectURL(selectedFile);
      setFilePreviewUrl(url);
    } else {
      setFilePreviewUrl(null); // PDF icon fallback
    }
  };

  const handleUploadAndExtract = async () => {
    if (!file) return;

    setUploadLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    if (selectedClient) {
      formData.append('client_id', selectedClient.ref);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/commandes/import-document`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.status === 503) {
        throw new Error("Service d'extraction temporairement indisponible (timeout ou erreur OpenAI).");
      }

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || "Erreur lors de l'extraction de la commande.");
      }

      const result = await response.json();

      if (result.success === false) {
        throw new Error(result.erreur || "Le document est illisible ou ne contient aucune commande.");
      }

      // Populate data
      setExtractedData(result);
      
      // Auto-detect and link client if matching client name is returned and no client selected
      if (result.clientNom && !selectedClient) {
        const matchedClient = clients.find(c => 
          c.name.toLowerCase().includes(result.clientNom.toLowerCase()) ||
          result.clientNom.toLowerCase().includes(c.name.toLowerCase())
        );
        if (matchedClient) {
          setSelectedClient(matchedClient);
        }
      }

      setStep(2); // Go to review
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadLoading(false);
    }
  };

  // Manual search for articles SAGE on a row
  const handleArticleSearch = async (rowId, query) => {
    setSearchQueries(prev => ({ ...prev, [rowId]: query }));
    if (query.trim().length < 2) {
      setSearchResults(prev => ({ ...prev, [rowId]: [] }));
      return;
    }

    setSearchLoading(prev => ({ ...prev, [rowId]: true }));
    try {
      const response = await fetch(`${API_BASE_URL}/articles/search?q=${encodeURIComponent(query)}&limit=10`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSearchResults(prev => ({ ...prev, [rowId]: data }));
      }
    } catch (err) {
      console.error("Erreur recherche articles SAGE:", err);
    } finally {
      setSearchLoading(prev => ({ ...prev, [rowId]: false }));
    }
  };

  // Select SAGE article for a row (from search or alternatives)
  const handleSelectArticle = (rowId, article) => {
    const updatedLignes = extractedData.lignes.map(l => {
      if (l.idLigne === rowId) {
        return {
          ...l,
          statut: "auto_validé",
          scoreGlobal: 1.0,
          articleSage: {
            reference: article.reference || article.Reference,
            designationOfficielle: article.designation_officielle || article.DesignationOfficielle,
            tarifUnitaire: article.tarif_unitaire || article.TarifUnitaire,
            unite: article.unite || article.Unite || 'pce',
            stockQuantity: article.stockQuantity !== undefined ? article.stockQuantity : article.StockQuantity
          }
        };
      }
      return l;
    });

    setExtractedData(prev => ({ ...prev, lignes: updatedLignes }));
    // Clear search states for this row
    setSearchResults(prev => {
      const copy = { ...prev };
      delete copy[rowId];
      return copy;
    });
    setSearchQueries(prev => {
      const copy = { ...prev };
      delete copy[rowId];
      return copy;
    });
  };

  // Update row quantity
  const handleQuantityChange = (rowId, qty) => {
    const parsedQty = parseFloat(qty);
    if (isNaN(parsedQty) || parsedQty <= 0) return;

    const updatedLignes = extractedData.lignes.map(l => {
      if (l.idLigne === rowId) {
        return { ...l, quantite: parsedQty };
      }
      return l;
    });
    setExtractedData(prev => ({ ...prev, lignes: updatedLignes }));
  };

  // Delete line
  const handleDeleteLine = (rowId) => {
    const filteredLignes = extractedData.lignes.filter(l => l.idLigne !== rowId);
    setExtractedData(prev => ({ ...prev, lignes: filteredLignes }));
  };

  // SAGE order submission
  const handleCreateSageOrder = async () => {
    // Verification: all rows must be matched (auto_validé)
    const hasUnresolved = extractedData.lignes.some(l => l.statut !== 'auto_validé');
    if (hasUnresolved) {
      setError("Veuillez résoudre toutes les lignes non identifiées ou à réviser avant de créer la commande.");
      return;
    }

    setSubmitLoading(true);
    setError(null);

    const clientRef = selectedClient ? selectedClient.ref : 'CLIENT_PARTICULIER';

    try {
      const response = await fetch(`${API_BASE_URL}/Order/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          customerRef: clientRef,
          items: extractedData.lignes.map(l => ({
            productRef: l.articleSage.reference,
            quantity: l.quantite
          })),
          deliveryAddressName: "",
          deliveryStreet: "",
          deliveryCity: ""
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Erreur de création de commande SAGE.");
      }

      const orderResult = await response.json();
      setSuccessOrder(orderResult);
      setShowSuccessModal(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  // Printable Summary PDF / print layout
  const handlePrintRecap = () => {
    window.print();
  };

  // Count items by status
  const totalCount = extractedData.lignes.length;
  const autoValidatedCount = extractedData.lignes.filter(l => l.statut === 'auto_validé').length;
  const toReviewCount = extractedData.lignes.filter(l => l.statut === 'a_reviser').length;
  const unidentifiedCount = extractedData.lignes.filter(l => l.statut === 'non_identifié').length;

  const totalHT = extractedData.lignes.reduce((sum, l) => {
    const price = l.articleSage?.tarifUnitaire || 0;
    return sum + (price * l.quantite);
  }, 0);
  const tva = totalHT * 0.20;
  const totalTTC = totalHT + tva;

  return (
    <Layout>
      <div className="p-4 md:p-10 max-w-7xl mx-auto w-full space-y-6 text-left pb-32 lg:pb-10 no-print">
        
        {/* Wizard Progress bar */}
        <section className="bg-white rounded-3xl p-6 border border-outline-variant/30 custom-shadow flex justify-between items-center max-w-xl mx-auto">
          <div className="flex items-center gap-2">
            <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[14px] ${step === 1 ? 'bg-primary text-on-primary' : 'bg-success-emerald text-white'}`}>
              {step > 1 ? <span className="material-symbols-outlined text-[18px]">check</span> : '1'}
            </span>
            <span className={`text-[13px] font-bold ${step === 1 ? 'text-primary' : 'text-outline'}`}>Téléversement</span>
          </div>
          <div className="h-0.5 w-12 bg-outline-variant/30 flex-1 mx-2"></div>
          <div className="flex items-center gap-2">
            <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[14px] ${step === 2 ? 'bg-primary text-on-primary' : step > 2 ? 'bg-success-emerald text-white' : 'bg-surface-container-high text-outline'}`}>
              {step > 2 ? <span className="material-symbols-outlined text-[18px]">check</span> : '2'}
            </span>
            <span className={`text-[13px] font-bold ${step === 2 ? 'text-primary' : 'text-outline'}`}>Révision OCR</span>
          </div>
          <div className="h-0.5 w-12 bg-outline-variant/30 flex-1 mx-2"></div>
          <div className="flex items-center gap-2">
            <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[14px] ${step === 3 ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-outline'}`}>
              3
            </span>
            <span className={`text-[13px] font-bold ${step === 3 ? 'text-primary' : 'text-outline'}`}>Validation SAGE</span>
          </div>
        </section>

        {/* Global Error Banner */}
        {error && (
          <div className="bg-error/10 border border-error/20 text-error rounded-2xl p-4 flex gap-3 items-center animate-fade-in max-w-3xl mx-auto">
            <span className="material-symbols-outlined">error</span>
            <p className="text-[14px] font-semibold">{error}</p>
          </div>
        )}

        {/* STEP 1: UPLOAD & PROCESSING */}
        {step === 1 && (
          <div className="max-w-3xl mx-auto space-y-6">
            
            {/* Header info */}
            <div className="bg-white rounded-3xl p-6 md:p-8 border border-outline-variant/30 custom-shadow flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <h2 className="text-[24px] font-black text-primary">Import de commande par Vision (IA)</h2>
                <p className="text-[13px] text-on-surface-variant font-medium mt-1">
                  Déposez un bon de commande scanné ou une photo de commande manuscrite. GPT-4o Vision extraira automatiquement les lignes pour les lier au catalogue SAGE.
                </p>
              </div>

              {/* Client selector dropdown */}
              <div className="relative w-full md:w-72" ref={clientDropdownRef}>
                <label className="text-[11px] font-bold text-outline uppercase tracking-wider mb-1 block">
                  Client SAGE (Optionnel)
                </label>
                <button
                  onClick={() => setShowClientDropdown(!showClientDropdown)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-2.5 bg-surface border border-outline-variant rounded-xl text-[13px] font-bold text-primary hover:bg-surface-container-low transition-all"
                >
                  <span className="truncate">{selectedClient ? selectedClient.name : 'SAGE par défaut'}</span>
                  <span className="material-symbols-outlined text-outline text-[18px]">
                    {showClientDropdown ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {showClientDropdown && (
                  <div className="absolute left-0 mt-2 w-full bg-white border border-outline-variant rounded-2xl shadow-xl z-50 p-3">
                    <div className="flex items-center gap-2 bg-surface-container rounded-xl px-3 py-1.5 border border-outline-variant mb-2">
                      <span className="material-symbols-outlined text-outline text-[16px]">search</span>
                      <input
                        className="bg-transparent border-none focus:ring-0 text-[12px] w-full outline-none"
                        placeholder="Chercher client..."
                        type="text"
                        value={clientSearchQuery}
                        onChange={(e) => setClientSearchQuery(e.target.value)}
                        autoFocus
                      />
                    </div>
                    
                    <div className="max-h-40 overflow-y-auto flex flex-col gap-1 pr-1 custom-scrollbar">
                      <button
                        onClick={() => {
                          setSelectedClient(null);
                          setShowClientDropdown(false);
                        }}
                        className="w-full text-left px-3 py-1.5 rounded-lg text-[12px] font-semibold text-on-surface hover:bg-surface-container-high"
                      >
                        Aucun (SAGE par défaut)
                      </button>
                      
                      {clients
                        .filter(c => 
                          c.name.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
                          c.ref.toLowerCase().includes(clientSearchQuery.toLowerCase())
                        )
                        .map(client => (
                          <button
                            key={client.ref}
                            onClick={() => {
                              setSelectedClient(client);
                              setShowClientDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 rounded-lg text-[12px] flex flex-col transition-all ${
                              selectedClient?.ref === client.ref ? 'bg-secondary text-white' : 'text-on-surface hover:bg-surface-container-high'
                            }`}
                          >
                            <span className="font-bold">{client.name}</span>
                            <span className="text-[9px] opacity-80">{client.ref}</span>
                          </button>
                        ))
                      }
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Dropzone */}
            <section 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-3xl p-12 text-center transition-all cursor-pointer bg-white ${
                isDragOver ? 'border-secondary bg-secondary/5 scale-[1.01]' : 'border-outline-variant/60 hover:border-secondary/60'
              }`}
              onClick={() => document.getElementById('documentFileInput').click()}
            >
              <input 
                type="file" 
                id="documentFileInput" 
                className="hidden" 
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={handleFileChange}
              />
              
              <div className="space-y-4 max-w-sm mx-auto">
                <div className="w-20 h-20 bg-secondary/10 text-secondary rounded-full flex items-center justify-center mx-auto shadow-sm">
                  <span className="material-symbols-outlined text-[36px]">photo_camera_back</span>
                </div>
                
                {fileName ? (
                  <div className="space-y-1">
                    <p className="text-[16px] font-bold text-primary truncate px-4">{fileName}</p>
                    <p className="text-[12px] text-success-emerald font-semibold">Prêt pour l'extraction</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[16px] font-bold text-primary">Déposer le bon de commande</p>
                    <p className="text-[12px] text-outline leading-relaxed">
                      Glissez votre PDF, photo de bon manuscrit ou scan.<br/>
                      Formats acceptés : PDF, PNG, JPG, JPEG, WEBP (Max 10 Mo).
                    </p>
                  </div>
                )}
                
                {!fileName && (
                  <button className="bg-secondary/10 hover:bg-secondary/20 text-secondary px-6 py-2.5 rounded-xl text-[13px] font-bold transition-all">
                    Parcourir les fichiers
                  </button>
                )}
              </div>
            </section>

            {/* Preview image or file icon if selected */}
            {file && (
              <div className="bg-white rounded-3xl p-6 border border-outline-variant/30 custom-shadow flex flex-col md:flex-row items-center justify-between gap-6 animate-fade-in">
                <div className="flex items-center gap-4">
                  {filePreviewUrl ? (
                    <div className="w-16 h-16 rounded-xl overflow-hidden border border-outline-variant/30 shadow-sm bg-surface">
                      <img className="w-full h-full object-cover" src={filePreviewUrl} alt="Preview" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-red-50 text-red-500 flex items-center justify-center border border-red-100 shadow-sm">
                      <span className="material-symbols-outlined text-[32px]">picture_as_pdf</span>
                    </div>
                  )}
                  <div className="text-left">
                    <p className="text-[14px] font-bold text-primary truncate max-w-xs md:max-w-md">{fileName}</p>
                    <p className="text-[12px] text-outline">{(file.size / 1024 / 1024).toFixed(2)} Mo</p>
                  </div>
                </div>

                <button
                  onClick={handleUploadAndExtract}
                  disabled={uploadLoading}
                  className="w-full md:w-auto h-12 bg-primary text-on-primary font-bold px-8 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 active:scale-95 transition-all disabled:opacity-50"
                >
                  {uploadLoading ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                      <span>Analyse IA en cours (5-10s)...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined">analytics</span>
                      <span>Lancer l'extraction IA</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: REVIEW Extracted lines */}
        {step === 2 && (
          <div className="space-y-6">
            
            {extractedData.isMock && (
              <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 flex items-start gap-4 text-amber-900 custom-shadow">
                <span className="material-symbols-outlined text-amber-600 text-[28px] mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                <div className="text-left">
                  <h4 className="font-bold text-[15px] text-amber-800">Mode Simulation Activé (Quota API OpenAI Épuisé)</h4>
                  <p className="text-[13px] text-amber-700/90 mt-1 leading-relaxed">
                    Votre clé API OpenAI a renvoyé une erreur de quota (<strong>HTTP 429 - Insufficient Quota</strong>). 
                    Afin de vous permettre de tester l'intégration de bout en bout (matching, modification des quantités, alternatives de recherche et envoi vers SAGE), 
                    le système a automatiquement simulé l'extraction des lignes correspondant à votre document.
                  </p>
                </div>
              </div>
            )}

            {/* Header info */}
            <div className="bg-white rounded-3xl p-6 border border-outline-variant/30 custom-shadow flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="text-left">
                <h3 className="text-[20px] font-black text-primary">Révision des lignes de commande</h3>
                <p className="text-[12px] text-on-surface-variant font-medium mt-0.5">
                  Vérifiez la correspondance avec le catalogue SAGE. Corrigez les lignes orange ou rouges.
                </p>
              </div>
              <div className="flex gap-2">
                <span className="bg-success-emerald/10 text-success-emerald px-3 py-1 rounded-full text-[12px] font-bold">
                  {autoValidatedCount} Validés
                </span>
                {toReviewCount > 0 && (
                  <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-[12px] font-bold">
                    {toReviewCount} À réviser
                  </span>
                )}
                {unidentifiedCount > 0 && (
                  <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-[12px] font-bold">
                    {unidentifiedCount} Non identifiés
                  </span>
                )}
              </div>
            </div>

            {/* Table layout */}
            <div className="bg-white rounded-3xl border border-outline-variant/30 overflow-hidden custom-shadow">
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-outline text-[11px] font-bold uppercase tracking-wider border-b border-outline-variant/20">
                      <th className="py-3.5 px-4 w-10 text-center">Lig</th>
                      <th className="py-3.5 px-4 w-1/3">Désignation lue (OCR)</th>
                      <th className="py-3.5 px-4 w-1/3">Article SAGE Résolu</th>
                      <th className="py-3.5 px-4 w-24 text-center">Quantité</th>
                      <th className="py-3.5 px-4 w-28 text-center">Prix Unitaire</th>
                      <th className="py-3.5 px-4 w-20 text-center">Score</th>
                      <th className="py-3.5 px-4 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10 text-[13px]">
                    {extractedData.lignes.map((ligne) => {
                      const rowId = ligne.idLigne;
                      const hasMatch = !!ligne.articleSage;
                      const isAutoValidated = ligne.statut === 'auto_validé';
                      const isToReview = ligne.statut === 'a_reviser';
                      const isUnidentified = ligne.statut === 'non_identifié';

                      return (
                        <tr 
                          key={rowId} 
                          className={`transition-colors ${
                            isAutoValidated 
                              ? 'bg-success-emerald/[0.02] hover:bg-success-emerald/[0.04]' 
                              : isToReview
                                ? 'bg-orange-50/30 hover:bg-orange-50/50'
                                : 'bg-red-50/20 hover:bg-red-50/40'
                          }`}
                        >
                          {/* Row Number */}
                          <td className="py-4 px-4 text-center text-outline font-bold">{rowId}</td>

                          {/* Raw OCR text read */}
                          <td className="py-4 px-4 font-medium text-slate-500 bg-slate-50/40 italic">
                            {ligne.designationBrute}
                          </td>

                          {/* SAGE Match & Selection */}
                          <td className="py-4 px-4">
                            {isAutoValidated && hasMatch ? (
                              <div className="flex flex-col">
                                <span className="font-bold text-success-emerald flex items-center gap-1.5">
                                  <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                  {ligne.articleSage.designationOfficielle}
                                </span>
                                <span className="text-[10px] text-outline font-semibold">Ref: {ligne.articleSage.reference}</span>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <div className="text-error font-semibold flex items-center gap-1 mb-1">
                                  <span className="material-symbols-outlined text-[16px]">warning</span>
                                  {isToReview ? "Ligne à réviser" : "Article non identifié"}
                                </div>
                                
                                {/* 1. Alternatives select dropdown */}
                                {ligne.alternatives && ligne.alternatives.length > 0 && (
                                  <div className="space-y-1">
                                    <label className="text-[10px] text-outline font-bold uppercase block">Alternatives suggérées :</label>
                                    <select
                                      onChange={(e) => {
                                        const alt = ligne.alternatives.find(a => a.reference === e.target.value);
                                        if (alt) handleSelectArticle(rowId, alt);
                                      }}
                                      className="w-full bg-surface border border-outline-variant/60 rounded-xl px-3 py-1.5 text-[12px] outline-none"
                                      defaultValue=""
                                    >
                                      <option value="" disabled>Sélectionner une alternative...</option>
                                      {ligne.alternatives.map((alt, aIdx) => (
                                        <option key={aIdx} value={alt.reference}>
                                          {alt.designationOfficielle} ({alt.reference}) — {(alt.tarifUnitaire).toFixed(2)} Dhs
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}

                                {/* 2. Search free text */}
                                <div className="relative">
                                  <label className="text-[10px] text-outline font-bold uppercase block mb-1">Recherche catalogue SAGE :</label>
                                  <div className="flex items-center bg-surface border border-outline-variant/60 rounded-xl px-3 py-1.5 focus-within:border-secondary transition-all">
                                    <span className="material-symbols-outlined text-outline text-[16px]">search</span>
                                    <input
                                      type="text"
                                      placeholder="Saisir nom ou référence..."
                                      className="bg-transparent border-none focus:ring-0 text-[12px] w-full outline-none pl-2"
                                      value={searchQueries[rowId] || ''}
                                      onChange={(e) => handleArticleSearch(rowId, e.target.value)}
                                    />
                                    {searchLoading[rowId] && (
                                      <span className="material-symbols-outlined animate-spin text-outline text-[14px]">progress_activity</span>
                                    )}
                                  </div>

                                  {/* Search Suggestions dropdown */}
                                  {searchResults[rowId] && searchResults[rowId].length > 0 && (
                                    <div className="absolute left-0 mt-1 w-full bg-white border border-outline-variant rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto p-1 custom-scrollbar">
                                      {searchResults[rowId].map((art, artIdx) => (
                                        <button
                                          key={artIdx}
                                          onClick={() => handleSelectArticle(rowId, art)}
                                          className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg flex flex-col transition-all text-[12px]"
                                        >
                                          <span className="font-bold text-primary">{art.designation_officielle}</span>
                                          <span className="text-[10px] text-outline">Ref: {art.reference} • {art.tarif_unitaire.toFixed(2)} Dhs • Stock: {art.stockQuantity}</span>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Quantity (Editable) */}
                          <td className="py-4 px-4 text-center">
                            <input
                              type="number"
                              min="0.01"
                              step="any"
                              className="w-20 text-center font-bold text-[14px] bg-surface-container border border-outline-variant/60 rounded-xl py-1"
                              value={ligne.quantite}
                              onChange={(e) => handleQuantityChange(rowId, e.target.value)}
                            />
                            {ligne.articleSage && (
                              <p className="text-[10px] text-outline mt-1 font-semibold">{ligne.articleSage.unite}</p>
                            )}
                          </td>

                          {/* Unit price from SAGE */}
                          <td className="py-4 px-4 text-center font-bold text-slate-700">
                            {ligne.articleSage ? (
                              <>
                                <p>{ligne.articleSage.tarifUnitaire.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Dhs</p>
                                <p className="text-[10px] text-outline font-normal">
                                  Total: {(ligne.articleSage.tarifUnitaire * ligne.quantite).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Dhs
                                </p>
                              </>
                            ) : (
                              <span className="text-outline italic">—</span>
                            )}
                          </td>

                          {/* Trust OCR score */}
                          <td className="py-4 px-4 text-center">
                            <span className={`px-2 py-1 rounded-full text-[11px] font-black ${
                              isAutoValidated 
                                ? 'bg-success-emerald/10 text-success-emerald' 
                                : isToReview
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-red-100 text-red-800'
                            }`}>
                              {Math.round(ligne.scoreGlobal * 100)}%
                            </span>
                          </td>

                          {/* Delete line */}
                          <td className="py-4 px-4 text-center">
                            <button
                              onClick={() => handleDeleteLine(rowId)}
                              className="text-outline hover:text-error transition-colors p-1"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Revison navigation controls */}
            <div className="flex justify-between items-center bg-white rounded-3xl p-6 border border-outline-variant/30 custom-shadow">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-3 border border-outline rounded-2xl text-[14px] font-bold text-outline hover:bg-slate-50 transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                <span>Retour</span>
              </button>

              <button
                onClick={() => {
                  setError(null);
                  const hasUnresolved = extractedData.lignes.some(l => l.statut !== 'auto_validé');
                  if (hasUnresolved) {
                    setError("Veuillez résoudre toutes les lignes de commande (toutes doivent être marquées en vert).");
                    return;
                  }
                  setStep(3); // Go to confirm
                }}
                className="px-8 py-3 bg-secondary text-white font-bold rounded-2xl text-[14px] hover:opacity-95 active:scale-95 transition-all flex items-center gap-2 shadow-md"
              >
                <span>Étape Suivante : Récapitulatif</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: ORDER SUMMARY & SUBMIT */}
        {step === 3 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left side: lines review */}
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white rounded-3xl border border-outline-variant/30 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-outline-variant/30 bg-surface-container-low/20">
                  <h3 className="text-[18px] font-black text-primary">Récapitulatif des Lignes</h3>
                </div>

                <ul className="divide-y divide-outline-variant/10">
                  {extractedData.lignes.map((ligne) => (
                    <li key={ligne.idLigne} className="p-6 flex items-center justify-between gap-4">
                      <div>
                        <h4 className="text-[14px] font-bold text-primary">{ligne.articleSage.designationOfficielle}</h4>
                        <p className="text-[11px] text-outline font-semibold uppercase mt-0.5">
                          Ref: {ligne.articleSage.reference} • Unité: {ligne.articleSage.unite}
                        </p>
                      </div>
                      
                      <div className="text-right">
                        <p className="text-[14px] font-black text-primary">
                          {ligne.quantite} × {ligne.articleSage.tarifUnitaire.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Dhs
                        </p>
                        <p className="text-[12px] text-secondary font-bold">
                          {(ligne.quantite * ligne.articleSage.tarifUnitaire).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Dhs
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Right side: client and checkout summary */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white rounded-3xl border border-outline-variant/30 p-6 shadow-lg space-y-6">
                <h3 className="text-[18px] font-black text-primary border-b border-outline-variant/20 pb-3">
                  Validation de la commande
                </h3>

                {/* Client detail card */}
                <div className="p-4 bg-secondary/5 rounded-2xl border border-secondary/20 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-secondary uppercase tracking-wider">Client Destinataire</span>
                    <span className="px-2 py-0.5 bg-secondary/15 text-secondary text-[9px] font-extrabold rounded">SAGE 100</span>
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-primary">
                      {selectedClient ? selectedClient.name : 'SAGE par défaut'}
                    </p>
                    <p className="text-[11px] text-outline font-semibold">
                      {selectedClient ? `Code Client: ${selectedClient.ref}` : 'Aucune surcharge de client'}
                    </p>
                  </div>
                  {extractedData.clientNom && !selectedClient && (
                    <p className="text-[10px] text-amber-600 bg-amber-50 p-1.5 rounded border border-amber-100">
                      Détecté OCR : <strong>{extractedData.clientNom}</strong>
                    </p>
                  )}
                </div>

                {/* Extracted metadata details */}
                <div className="space-y-2 text-[12px] text-on-surface-variant font-medium border-b border-outline-variant/20 pb-4">
                  {extractedData.clientRefExterne && (
                    <div className="flex justify-between">
                      <span>Réf Commande Client :</span>
                      <span className="font-bold text-primary">{extractedData.clientRefExterne}</span>
                    </div>
                  )}
                  {extractedData.dateDocument && (
                    <div className="flex justify-between">
                      <span>Date Document :</span>
                      <span className="font-bold text-primary">{extractedData.dateDocument}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Lignes de Commande :</span>
                    <span className="font-bold text-primary">{totalCount} lignes</span>
                  </div>
                </div>

                {/* Totals */}
                <div className="space-y-3 text-[14px]">
                  <div className="flex justify-between font-semibold">
                    <span className="text-on-surface-variant">Sous-total HT</span>
                    <span className="text-primary">{totalHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Dhs</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-on-surface-variant">TVA (20%)</span>
                    <span className="text-primary">{tva.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Dhs</span>
                  </div>
                  <div className="pt-3 border-t border-outline-variant/20 flex justify-between items-end">
                    <div>
                      <p className="text-[11px] font-bold text-primary uppercase tracking-wider">TOTAL TTC</p>
                      <p className="text-[9px] text-outline italic">Livraison estimée sous 48h</p>
                    </div>
                    <p className="text-[22px] font-black text-secondary">
                      {totalTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Dhs
                    </p>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="space-y-3 pt-3">
                  <button
                    onClick={handleCreateSageOrder}
                    disabled={submitLoading || totalCount === 0}
                    className="w-full h-14 bg-primary text-on-primary font-black rounded-2xl text-[15px] flex items-center justify-center gap-2 hover:bg-slate-800 active:scale-95 transition-all disabled:opacity-50 shadow-md"
                  >
                    {submitLoading ? (
                      <>
                        <span className="material-symbols-outlined animate-spin">progress_activity</span>
                        <span>Création dans SAGE 100...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined">receipt_long</span>
                        <span>Créer la Commande SAGE</span>
                      </>
                    )}
                  </button>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setStep(2)}
                      className="w-1/2 py-2.5 border border-outline rounded-xl text-[12px] font-bold text-outline hover:bg-slate-50 transition-all text-center"
                    >
                      Corriger
                    </button>
                    <button
                      onClick={handlePrintRecap}
                      className="w-1/2 py-2.5 bg-secondary/10 hover:bg-secondary/20 text-secondary rounded-xl text-[12px] font-bold transition-all flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[16px]">print</span>
                      <span>Imprimer</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300">
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full mx-4 text-center border border-outline-variant/30">
            <div className="w-20 h-20 bg-success-emerald/10 text-success-emerald rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-[48px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                check_circle
              </span>
            </div>
            <h4 className="text-[20px] font-bold text-primary mb-2">Commande Créée !</h4>
            <p className="text-[13px] text-outline font-medium mb-6 leading-relaxed">
              La commande issue du document a été importée sous la pièce de vente SAGE{' '}
              <span className="font-bold text-primary">BoCmdVente {successOrder?.sageOrderRef}</span>.
            </p>
            <div className="space-y-2">
              <button
                onClick={handlePrintRecap}
                className="w-full py-3 border border-secondary text-secondary rounded-xl font-bold hover:bg-secondary/5 transition-all text-center text-[13px] flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-[18px]">print</span>
                <span>Télécharger/Imprimer Récapitulatif</span>
              </button>
              <button 
                onClick={() => {
                  setShowSuccessModal(false);
                  navigate('/dashboard');
                }}
                className="w-full py-3 bg-primary text-on-primary rounded-xl font-bold hover:bg-slate-800 transition-all text-[13px]"
              >
                Retour au tableau de bord
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT LAYOUT (visible only on print) */}
      <div className="print-only p-10 text-left space-y-6 text-[12px] leading-relaxed">
        <div className="flex justify-between border-b pb-4">
          <div>
            <h1 className="text-[20px] font-bold">BON DE COMMANDE SAGE 100</h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Corporate Portal</p>
          </div>
          <div className="text-right">
            <p className="font-bold">N° Commande : {successOrder?.sageOrderRef || "PROVISOIRE"}</p>
            <p>Date : {new Date().toLocaleDateString('fr-FR')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-b pb-4">
          <div>
            <h2 className="font-bold text-[13px] mb-1">Tiers Destinataire :</h2>
            <p className="font-bold text-[13px]">{selectedClient ? selectedClient.name : "Client par défaut"}</p>
            <p>Code Client : {selectedClient ? selectedClient.ref : "CLIENT_PARTICULIER"}</p>
            {extractedData.clientRefExterne && <p>Réf Commande Externe : {extractedData.clientRefExterne}</p>}
          </div>
          <div>
            <h2 className="font-bold text-[13px] mb-1">Détails d'origine :</h2>
            <p>Fichier source : {fileName}</p>
            <p>Hash source : {extractedData.fileHash || "Non disponible"}</p>
            {extractedData.dateDocument && <p>Date document source : {extractedData.dateDocument}</p>}
          </div>
        </div>

        <div>
          <h2 className="font-bold text-[13px] mb-2">Lignes de commande :</h2>
          <table className="w-full border-collapse border text-[11px]">
            <thead>
              <tr className="bg-gray-100 border">
                <th className="p-2 border w-12 text-center">N°</th>
                <th className="p-2 border">Référence SAGE</th>
                <th className="p-2 border">Désignation Officielle</th>
                <th className="p-2 border text-center w-20">Quantité</th>
                <th className="p-2 border text-right w-24">Prix Unit. HT</th>
                <th className="p-2 border text-right w-28">Total HT</th>
              </tr>
            </thead>
            <tbody>
              {extractedData.lignes.map((l, idx) => (
                <tr key={idx} className="border">
                  <td className="p-2 border text-center">{idx + 1}</td>
                  <td className="p-2 border font-mono">{l.articleSage.reference}</td>
                  <td className="p-2 border">{l.articleSage.designationOfficielle}</td>
                  <td className="p-2 border text-center">{l.quantite}</td>
                  <td className="p-2 border text-right">{l.articleSage.tarifUnitaire.toFixed(2)} Dhs</td>
                  <td className="p-2 border text-right">{(l.articleSage.tarifUnitaire * l.quantite).toFixed(2)} Dhs</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end pt-4">
          <div className="w-64 space-y-1.5 border p-4 bg-gray-50 rounded">
            <div className="flex justify-between font-semibold">
              <span>Total HT :</span>
              <span>{totalHT.toFixed(2)} Dhs</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>TVA (20%) :</span>
              <span>{tva.toFixed(2)} Dhs</span>
            </div>
            <div className="flex justify-between font-bold border-t pt-1.5 text-[14px]">
              <span>TOTAL TTC :</span>
              <span>{totalTTC.toFixed(2)} Dhs</span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
