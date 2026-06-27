import React, { useState, useEffect, useRef } from 'react';
import { useAuth, API_BASE_URL } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import * as XLSX from 'xlsx';

export default function ImportExcel() {
  const { token, user, selectedClient, setSelectedClient } = useAuth();
  const navigate = useNavigate();

  // Page states
  const [clients, setClients] = useState([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const dropdownRef = useRef(null);

  // File import states
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [parseLoading, setParseLoading] = useState(false);
  const [validationLoading, setValidationLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  
  // Data states
  const [parsedRows, setParsedRows] = useState([]); // Raw parsed data: { code, quantity }
  const [validatedItems, setValidatedItems] = useState([]); // API validated data: ValidatedImportItem
  const [error, setError] = useState(null);
  const [successOrder, setSuccessOrder] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Fetch client list on mount
  useEffect(() => {
    if (user?.role === 'Administrator' && token) {
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
      .catch(err => console.error("Erreur de chargement des clients:", err));
    }
  }, [user, token]);

  // Click outside listener to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowClientDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Smart header detection
  const detectHeaders = (headers) => {
    let codeHeader = null;
    let qtyHeader = null;

    for (const h of headers) {
      const hl = h.toLowerCase().trim();
      if (!codeHeader && (hl.includes('ref') || hl.includes('art') || hl.includes('code') || hl.includes('barre') || hl.includes('cb') || hl.includes('ean'))) {
        codeHeader = h;
      }
      if (!qtyHeader && (hl.includes('quant') || hl.includes('qte') || hl.includes('qty') || hl.includes('qte'))) {
        qtyHeader = h;
      }
    }

    // Fallbacks if not detected
    if (!codeHeader && headers.length > 0) codeHeader = headers[0];
    if (!qtyHeader && headers.length > 1) qtyHeader = headers[1];

    return { codeHeader, qtyHeader };
  };

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
    if (ext !== 'xlsx' && ext !== 'xls') {
      setError('Format invalide. Veuillez importer un fichier Excel (.xlsx ou .xls).');
      return;
    }
    setFile(selectedFile);
    setFileName(selectedFile.name);
    parseExcel(selectedFile);
  };

  const parseExcel = (excelFile) => {
    setParseLoading(true);
    setValidatedItems([]);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Parse raw rows as JSON objects
        const rawJson = XLSX.utils.sheet_to_json(worksheet);
        
        if (rawJson.length === 0) {
          throw new Error("Le fichier Excel est vide.");
        }

        // Detect headers
        const headers = Object.keys(rawJson[0]);
        const { codeHeader, qtyHeader } = detectHeaders(headers);

        const rows = rawJson.map((row, idx) => {
          let codeStr = row[codeHeader] !== undefined ? String(row[codeHeader]).trim() : '';
          let qtyStr = row[qtyHeader] !== undefined ? String(row[qtyHeader]).trim() : '1';

          // Nettoyer la quantité
          let qtyVal = parseFloat(qtyStr.replace(',', '.'));
          if (isNaN(qtyVal) || qtyVal <= 0) {
            qtyVal = 1;
          }

          return {
            rowNum: idx + 1,
            code: codeStr,
            quantity: qtyVal
          };
        }).filter(r => r.code !== '');

        setParsedRows(rows);
      } catch (err) {
        setError("Erreur lors de la lecture du fichier Excel: " + err.message);
      } finally {
        setParseLoading(false);
      }
    };
    reader.readAsArrayBuffer(excelFile);
  };

  const handleValidateImport = async () => {
    if (parsedRows.length === 0) return;
    
    // Un client est requis pour tarifer et vérifier les règles d'accès SAGE
    const clientRef = selectedClient ? selectedClient.ref : 'CLIENT_PARTICULIER';

    setValidationLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/Catalog/validate-import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          customerRef: clientRef,
          items: parsedRows.map(r => ({ code: r.code, quantity: r.quantity }))
        })
      });

      if (!response.ok) {
        throw new Error("Erreur de communication avec le service de validation SAGE.");
      }

      const results = await response.json();
      setValidatedItems(results);
    } catch (err) {
      setError(err.message);
    } finally {
      setValidationLoading(false);
    }
  };

  // Recalculer la validation automatiquement si l'ADV change de client en cours de route
  useEffect(() => {
    if (parsedRows.length > 0 && validatedItems.length > 0) {
      handleValidateImport();
    }
  }, [selectedClient]);

  const handleSubmitOrder = async () => {
    const validItems = validatedItems.filter(v => v.isValid);
    if (validItems.length === 0) {
      setError("Aucune ligne valide à commander.");
      return;
    }

    const clientRef = selectedClient ? selectedClient.ref : 'CLIENT_PARTICULIER';
    
    setSubmitLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/Order/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          customerRef: clientRef,
          items: validItems.map(item => ({
            productRef: item.productRef,
            quantity: item.inputQuantity
          })),
          deliveryAddressName: "",
          deliveryStreet: "",
          deliveryCity: ""
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || "Erreur de création de commande SAGE.");
      }

      const orderCreated = await response.json();
      setSuccessOrder(orderCreated);
      setShowSuccessModal(true);
      
      // Reset page state
      setFile(null);
      setFileName('');
      setParsedRows([]);
      setValidatedItems([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  // Totals calculations
  const validItems = validatedItems.filter(item => item.isValid);
  const invalidItems = validatedItems.filter(item => !item.isValid);
  
  const totalHT = validItems.reduce((sum, item) => sum + (item.proPrice * item.inputQuantity), 0);
  const tva = totalHT * 0.20;
  const totalTTC = totalHT + tva;

  return (
    <Layout>
      <div className="p-4 md:p-10 max-w-7xl mx-auto w-full space-y-6 text-left pb-32 lg:pb-10">
        
        {/* Header Summary */}
        <section className="bg-white rounded-3xl p-6 md:p-8 border border-outline-variant/30 custom-shadow flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-[26px] font-black text-primary">Import de Commandes Excel</h2>
            <p className="text-[14px] text-on-surface-variant font-medium mt-1">
              Téléversez un panier d'achat à partir d'un fichier Excel. Les prix négociés du client choisi seront calculés en direct.
            </p>
          </div>
          
          {/* Client selector component */}
          <div className="relative w-full md:w-80" ref={dropdownRef}>
            <label className="text-[12px] font-bold text-outline uppercase tracking-wider mb-1 block">
              Client SAGE Destinataire
            </label>
            <button
              onClick={() => setShowClientDropdown(!showClientDropdown)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-surface border border-outline-variant rounded-2xl text-[14px] font-bold text-primary hover:bg-surface-container-low transition-all"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[20px]">person</span>
                <span>{selectedClient ? selectedClient.name : 'SAGE par défaut'}</span>
              </div>
              <span className="material-symbols-outlined text-outline">
                {showClientDropdown ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {showClientDropdown && (
              <div className="absolute left-0 mt-2 w-full bg-white border border-outline-variant rounded-2xl shadow-xl z-50 p-3">
                <div className="flex items-center gap-2 bg-surface-container rounded-xl px-3 py-2 border border-outline-variant mb-2">
                  <span className="material-symbols-outlined text-outline text-[18px]">search</span>
                  <input
                    className="bg-transparent border-none focus:ring-0 text-[13px] w-full outline-none"
                    placeholder="Chercher client..."
                    type="text"
                    value={clientSearchQuery}
                    onChange={(e) => setClientSearchQuery(e.target.value)}
                    autoFocus
                  />
                  {clientSearchQuery && (
                    <span 
                      className="material-symbols-outlined text-outline text-[16px] cursor-pointer"
                      onClick={() => setClientSearchQuery('')}
                    >
                      close
                    </span>
                  )}
                </div>
                
                <div className="max-h-52 overflow-y-auto flex flex-col gap-1 pr-1 custom-scrollbar">
                  <button
                    onClick={() => {
                      setSelectedClient(null);
                      setShowClientDropdown(false);
                      setClientSearchQuery('');
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-[13px] font-semibold transition-all ${
                      !selectedClient ? 'bg-primary text-on-primary' : 'text-on-surface hover:bg-surface-container-high'
                    }`}
                  >
                    Aucun (SAGE par défaut)
                  </button>
                  
                  {clients
                    .filter(c => 
                      c.name.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
                      c.ref.toLowerCase().includes(clientSearchQuery.toLowerCase())
                    )
                    .map(client => {
                      const isSelected = selectedClient?.ref === client.ref;
                      return (
                        <button
                          key={client.ref}
                          onClick={() => {
                            setSelectedClient(client);
                            setShowClientDropdown(false);
                            setClientSearchQuery('');
                          }}
                          className={`w-full text-left px-3 py-2 rounded-xl text-[13px] flex flex-col transition-all ${
                            isSelected ? 'bg-secondary text-white' : 'text-on-surface hover:bg-surface-container-high'
                          }`}
                        >
                          <span className="font-bold text-[13px]">{client.name}</span>
                          <span className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-outline'}`}>{client.ref}</span>
                        </button>
                      );
                    })
                  }
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Global Error Banner */}
        {error && (
          <div className="bg-error/10 border border-error/20 text-error rounded-2xl p-4 flex gap-3 items-center">
            <span className="material-symbols-outlined">error</span>
            <p className="text-[14px] font-semibold">{error}</p>
          </div>
        )}

        {/* Drag & Drop Area */}
        <section 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-3xl p-10 text-center transition-all cursor-pointer ${
            isDragOver 
              ? 'border-secondary bg-secondary/5 scale-[1.01]' 
              : 'border-outline-variant/60 hover:border-secondary/60 bg-white hover:bg-slate-50'
          }`}
          onClick={() => document.getElementById('excelFileInput').click()}
        >
          <input 
            type="file" 
            id="excelFileInput" 
            className="hidden" 
            accept=".xlsx,.xls"
            onChange={handleFileChange}
          />
          
          <div className="space-y-4 max-w-sm mx-auto">
            <div className="w-16 h-16 bg-secondary/10 text-secondary rounded-full flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[32px]">upload_file</span>
            </div>
            
            {fileName ? (
              <div className="space-y-1">
                <p className="text-[15px] font-bold text-primary line-clamp-1">{fileName}</p>
                <p className="text-[12px] text-outline">Fichier chargé • {parsedRows.length} lignes extraites</p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-[15px] font-bold text-primary">Sélectionnez ou Glissez le fichier Excel</p>
                <p className="text-[12px] text-outline">Formats acceptés : .xlsx, .xls • Doit contenir les colonnes Référence (ou Code barre) et Quantité</p>
              </div>
            )}
            
            {!fileName && (
              <button className="bg-secondary/15 hover:bg-secondary/25 text-secondary px-5 py-2 rounded-xl text-[13px] font-bold transition-all">
                Parcourir
              </button>
            )}
          </div>
        </section>

        {/* Action Controls & Preview */}
        {parsedRows.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Table side (8 cols) */}
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white rounded-3xl border border-outline-variant/30 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-outline-variant/30 flex justify-between items-center bg-surface-container-low/20">
                  <h3 className="text-[16px] font-bold text-primary flex items-center gap-2">
                    <span className="material-symbols-outlined text-outline">table_chart</span>
                    Prévisualisation des Données
                  </h3>
                  
                  {validatedItems.length === 0 ? (
                    <button
                      onClick={handleValidateImport}
                      disabled={validationLoading}
                      className="bg-secondary text-white font-bold text-[13px] px-4 py-2 rounded-xl flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {validationLoading ? (
                        <>
                          <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                          <span>Validation SAGE...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[16px]">rule</span>
                          <span>Valider sur SAGE</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="flex gap-2 text-[12px] font-bold">
                      <span className="bg-success-emerald/10 text-success-emerald px-2.5 py-1 rounded-full">
                        {validItems.length} Valides
                      </span>
                      {invalidItems.length > 0 && (
                        <span className="bg-error/10 text-error px-2.5 py-1 rounded-full">
                          {invalidItems.length} Invalides
                        </span>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-outline text-[12px] font-bold uppercase tracking-wider border-b border-outline-variant/20">
                        <th className="py-3 px-4 w-12 text-center">Lig</th>
                        <th className="py-3 px-4">Code Importé</th>
                        <th className="py-3 px-4 w-20 text-center">Quantité</th>
                        <th className="py-3 px-4">Désignation SAGE</th>
                        <th className="py-3 px-4 w-28 text-center">Prix Unit.</th>
                        <th className="py-3 px-4 w-24 text-center">Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10 text-[13px]">
                      {validatedItems.length === 0 ? (
                        parsedRows.map((row) => (
                          <tr key={row.rowNum} className="hover:bg-slate-50">
                            <td className="py-3.5 px-4 text-center text-outline font-semibold">{row.rowNum}</td>
                            <td className="py-3.5 px-4 font-mono font-bold text-primary">{row.code}</td>
                            <td className="py-3.5 px-4 text-center font-bold text-primary">{row.quantity.toLocaleString('fr-FR')}</td>
                            <td className="py-3.5 px-4 text-outline italic" colSpan="3">En attente de validation SAGE...</td>
                          </tr>
                        ))
                      ) : (
                        validatedItems.map((item, idx) => (
                          <tr 
                            key={idx} 
                            className={`transition-colors ${
                              item.isValid 
                                ? 'hover:bg-success-emerald/5 bg-white' 
                                : 'bg-error/5 hover:bg-error/10'
                            }`}
                          >
                            <td className="py-3.5 px-4 text-center text-outline font-semibold">{idx + 1}</td>
                            <td className="py-3.5 px-4">
                              <p className="font-mono font-bold text-primary">{item.inputCode}</p>
                              {item.isValid && item.productRef !== item.inputCode && (
                                <p className="text-[10px] text-outline">Ref: {item.productRef}</p>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-center font-bold text-primary">{item.inputQuantity.toLocaleString('fr-FR')}</td>
                            
                            {item.isValid ? (
                              <>
                                <td className="py-3.5 px-4 font-semibold text-primary">
                                  <div className="line-clamp-1">{item.productName}</div>
                                  <div className="text-[10px] text-outline">{item.category}</div>
                                </td>
                                <td className="py-3.5 px-4 text-center font-bold text-secondary">
                                  {item.proPrice.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Dhs
                                </td>
                                <td className="py-3.5 px-4 text-center">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    item.stockQuantity > 0 
                                      ? 'bg-success-emerald/10 text-success-emerald' 
                                      : 'bg-amber-100 text-amber-900'
                                  }`}>
                                    {item.stockQuantity} ex.
                                  </span>
                                </td>
                              </>
                            ) : (
                              <td className="py-3.5 px-4 text-error font-medium" colSpan="3">
                                <div className="flex items-center gap-1.5">
                                  <span className="material-symbols-outlined text-[16px]">warning</span>
                                  <span>{item.errorMessage || "Code article introuvable."}</span>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Recap / Summary Side (4 cols) */}
            <div className="lg:col-span-4">
              <div className="bg-white rounded-3xl border border-outline-variant/30 p-6 shadow-lg space-y-6 text-left sticky top-28">
                <h3 className="text-[18px] font-black text-primary border-b border-outline-variant/20 pb-3">
                  Résumé de l'Import
                </h3>
                
                <div className="space-y-3 text-[14px]">
                  <div className="flex justify-between font-semibold">
                    <span className="text-on-surface-variant">Lignes Lues</span>
                    <span className="text-primary">{parsedRows.length}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-on-surface-variant">Articles Reconnus</span>
                    <span className="text-success-emerald">{validItems.length}</span>
                  </div>
                  {invalidItems.length > 0 && (
                    <div className="flex justify-between font-semibold text-error">
                      <span>Erreurs Bloquées</span>
                      <span>{invalidItems.length}</span>
                    </div>
                  )}
                  
                  {validatedItems.length > 0 && (
                    <div className="pt-4 border-t border-outline-variant/20 space-y-3">
                      <div className="flex justify-between font-medium">
                        <span className="text-on-surface-variant">Sous-total HT</span>
                        <span className="text-primary">{totalHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Dhs</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span className="text-on-surface-variant">TVA (20%)</span>
                        <span className="text-primary">{tva.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Dhs</span>
                      </div>
                      
                      <div className="pt-3 border-t border-outline-variant/20 flex justify-between items-end">
                        <div>
                          <p className="text-[12px] font-bold text-primary uppercase tracking-wider">Total Commande</p>
                          <p className="text-[10px] text-outline italic">Validé pour {selectedClient ? selectedClient.ref : 'SAGE'}</p>
                        </div>
                        <p className="text-[22px] font-black text-secondary">
                          {totalTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Dhs
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4">
                  {validatedItems.length === 0 ? (
                    <button
                      onClick={handleValidateImport}
                      disabled={validationLoading}
                      className="w-full h-14 bg-secondary text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 shadow-md"
                    >
                      {validationLoading ? (
                        <>
                          <span className="material-symbols-outlined animate-spin">progress_activity</span>
                          <span>Validation SAGE...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined">rule</span>
                          <span>Analyser & Valider</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={handleSubmitOrder}
                      disabled={submitLoading || validItems.length === 0}
                      className="w-full h-14 bg-primary text-on-primary font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-800 active:scale-95 transition-all disabled:opacity-50 shadow-md"
                    >
                      {submitLoading ? (
                        <>
                          <span className="material-symbols-outlined animate-spin">progress_activity</span>
                          <span>Génération BoCmd...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined">shopping_cart_checkout</span>
                          <span>Créer la Commande ({validItems.length} lig)</span>
                        </>
                      )}
                    </button>
                  )}
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
            <h4 className="text-[20px] font-bold text-primary mb-2">Commande Importée !</h4>
            <p className="text-[14px] text-outline font-medium mb-6 leading-relaxed">
              La commande Excel a été validée et enregistrée sous la pièce de vente SAGE{' '}
              <span className="font-bold text-primary">BoCmdVente {successOrder?.sageOrderRef}</span>.
            </p>
            <button 
              onClick={() => {
                setShowSuccessModal(false);
                navigate('/dashboard');
              }}
              className="w-full py-3.5 bg-primary text-on-primary rounded-2xl font-bold hover:bg-slate-800 transition-colors active:scale-98"
            >
              Aller au tableau de bord
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
