import React, { useEffect, useState } from 'react';
import { useAuth, API_BASE_URL } from '../contexts/AuthContext';
import Layout from '../components/Layout';

export default function Settings() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('sage'); // 'sage', 'access', or 'users'
  
  // Tab 1: SAGE Configuration State
  const [commercialPath, setCommercialPath] = useState('');
  const [accountingPath, setAccountingPath] = useState('');
  const [sageUser, setSageUser] = useState('');
  const [sagePassword, setSagePassword] = useState('');
  const [hasPassword, setHasPassword] = useState(false);
  const [openAIApiKey, setOpenAIApiKey] = useState('');
  const [hasOpenAIApiKey, setHasOpenAIApiKey] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [configSuccess, setConfigSuccess] = useState('');
  const [configError, setConfigError] = useState('');

  // Tab 2: Access Restrictions State
  const [restrictions, setRestrictions] = useState([]);
  const [products, setProducts] = useState([]);
  const [restrictionsLoading, setRestrictionsLoading] = useState(true);

  // Real SAGE metadata lists
  const [clientsList, setClientsList] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
  const [familiesList, setFamiliesList] = useState([]);
  const [metadataLoading, setMetadataLoading] = useState(false);
  
  // New restriction form state
  const [scope, setScope] = useState('Client'); // Client or PricingCategory
  const [scopeTarget, setScopeTarget] = useState('');
  const [restrictionType, setRestrictionType] = useState('Family'); // Family or Article
  const [restrictionTarget, setRestrictionTarget] = useState('');
  const [submittingRestriction, setSubmittingRestriction] = useState(false);
  const [restrictionSuccess, setRestrictionSuccess] = useState('');
  const [restrictionError, setRestrictionError] = useState('');

  // Tab 3: User Accounts Management State
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userFormOpen, setUserFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userFormSuccess, setUserFormSuccess] = useState('');
  const [userFormError, setUserFormError] = useState('');
  
  // User form fields
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState('Professional');
  const [userCustomerRef, setUserCustomerRef] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userCollaboratorId, setUserCollaboratorId] = useState('');
  const [userSageSupplierRef, setUserSageSupplierRef] = useState('');
  const [userAllowedCategories, setUserAllowedCategories] = useState([]);
  const [collaboratorsList, setCollaboratorsList] = useState([]);
  const [suppliersList, setSuppliersList] = useState([]);

  // Fetch SAGE configuration
  const fetchConfig = async () => {
    setConfigLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/Settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Erreur lors de la lecture des paramètres.');
      const data = await response.json();
      setCommercialPath(data.commercialFilePath || '');
      setAccountingPath(data.accountingFilePath || '');
      setSageUser(data.username || 'Administrateur');
      setHasPassword(data.hasPassword);
      setSagePassword(data.hasPassword ? '__UNCHANGED__' : '');
      setHasOpenAIApiKey(data.hasOpenAIApiKey);
      setOpenAIApiKey(data.hasOpenAIApiKey ? '__UNCHANGED__' : '');
    } catch (err) {
      setConfigError(err.message);
    } finally {
      setConfigLoading(false);
    }
  };

  // Fetch SAGE metadata (clients, categories, families)
  const fetchSageMetadata = async () => {
    setMetadataLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [clientsRes, catsRes, famsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/Settings/clients`, { headers }),
        fetch(`${API_BASE_URL}/Settings/categories`, { headers }),
        fetch(`${API_BASE_URL}/Settings/families`, { headers })
      ]);
      
      let firstClientNum = '';
      let firstCatId = '';
      let firstFamCode = '';

      if (clientsRes.ok) {
        const clientsData = await clientsRes.json();
        setClientsList(clientsData);
        if (clientsData.length > 0) {
          firstClientNum = clientsData[0].ctNum;
        }
      }
      if (catsRes.ok) {
        const catsData = await catsRes.json();
        setCategoriesList(catsData);
        if (catsData.length > 0) {
          firstCatId = catsData[0].id.toString();
        }
      }
      if (famsRes.ok) {
        const famsData = await famsRes.json();
        setFamiliesList(famsData);
        if (famsData.length > 0) {
          firstFamCode = famsData[0].code;
        }
      }

      // Set defaults depending on current selection
      setScope((prevScope) => {
        if (prevScope === 'Client' && firstClientNum) {
          setScopeTarget(firstClientNum);
        } else if (prevScope === 'PricingCategory' && firstCatId) {
          setScopeTarget(firstCatId);
        }
        return prevScope;
      });

      setRestrictionType((prevType) => {
        if (prevType === 'Family' && firstFamCode) {
          setRestrictionTarget(firstFamCode);
        }
        return prevType;
      });

    } catch (err) {
      console.error("Erreur de chargement des métadonnées SAGE:", err);
    } finally {
      setMetadataLoading(false);
    }
  };

  // Fetch Restrictions & Products
  const fetchRestrictionsAndProducts = async () => {
    setRestrictionsLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [restRes, prodRes] = await Promise.all([
        fetch(`${API_BASE_URL}/Settings/restrictions`, { headers }),
        fetch(`${API_BASE_URL}/Catalog/products`, { headers })
      ]);
      
      if (!restRes.ok || !prodRes.ok) throw new Error('Erreur de chargement.');
      
      const restData = await restRes.json();
      const prodData = await prodRes.json();
      
      setRestrictions(restData);
      setProducts(prodData);

      // Pre-select first product ref if restrictionType is Article
      setRestrictionType((prevType) => {
        if (prevType === 'Article' && prodData.length > 0) {
          setRestrictionTarget(prodData[0].ref);
        }
        return prevType;
      });
    } catch (err) {
      console.error(err);
    } finally {
      setRestrictionsLoading(false);
    }
  };

  // Fetch Users
  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/Settings/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Impossible de charger les utilisateurs.');
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setUsersLoading(false);
    }
  };

  // Fetch Sage Collaborators
  const fetchCollaborators = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/Settings/collaborators`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCollaboratorsList(data);
      }
    } catch (err) {
      console.error("Erreur de chargement des collaborateurs:", err);
    }
  };

  // Fetch Sage Suppliers
  const fetchSuppliers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/Settings/suppliers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSuppliersList(data);
      }
    } catch (err) {
      console.error("Erreur de chargement des fournisseurs:", err);
    }
  };

  const openCreateForm = () => {
    setEditingUser(null);
    setUserName('');
    setUserEmail('');
    setUserRole('Professional');
    setUserCustomerRef(clientsList[0]?.ctNum || '');
    setUserCollaboratorId('');
    setUserSageSupplierRef('');
    setUserAllowedCategories([]);
    setUserPassword('');
    setUserFormSuccess('');
    setUserFormError('');
    setUserFormOpen(true);
  };

  const openEditForm = (userObj) => {
    setEditingUser(userObj);
    setUserName(userObj.name);
    setUserEmail(userObj.email);
    setUserRole(userObj.role);
    setUserCustomerRef(userObj.customerRef || '');
    setUserCollaboratorId(userObj.sageCollaboratorId?.toString() || '');
    setUserSageSupplierRef(userObj.sageSupplierRef || '');
    setUserAllowedCategories(userObj.allowedCategories ? userObj.allowedCategories.split(',').filter(Boolean) : []);
    setUserPassword('');
    setUserFormSuccess('');
    setUserFormError('');
    setUserFormOpen(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setUserFormSuccess('');
    setUserFormError('');
    
    const isEdit = !!editingUser;
    const url = isEdit 
      ? `${API_BASE_URL}/Settings/users/${editingUser.id}` 
      : `${API_BASE_URL}/Settings/users`;
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: userEmail,
          name: userName,
          role: userRole,
          customerRef: userCustomerRef,
          sageCollaboratorId: userRole === 'Commercial' && userCollaboratorId ? parseInt(userCollaboratorId) : null,
          allowedCategories: userAllowedCategories.join(','),
          sageSupplierRef: userRole === 'Commercial' && userSageSupplierRef ? userSageSupplierRef : null,
          password: userPassword
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Erreur de sauvegarde de l'utilisateur.");

      setUserFormSuccess(isEdit ? "Compte utilisateur modifié avec succès." : "Compte utilisateur créé avec succès.");
      
      if (!isEdit) {
        setUserName('');
        setUserEmail('');
        setUserPassword('');
        setUserCustomerRef('');
        setUserCollaboratorId('');
        setUserSageSupplierRef('');
        setUserAllowedCategories([]);
        setUserRole('Professional');
      } else {
        setUserPassword('');
      }

      fetchUsers(); // Refresh
      
      setTimeout(() => {
        setUserFormOpen(false);
        setUserFormSuccess('');
      }, 1500);

    } catch (err) {
      setUserFormError(err.message);
    }
  };

  const handleDeleteUser = async (id, email) => {
    if (!confirm(`Voulez-vous vraiment supprimer le compte de ${email} ?`)) return;
    try {
      const response = await fetch(`${API_BASE_URL}/Settings/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Impossible de supprimer l'utilisateur.");
      
      fetchUsers(); // Refresh
    } catch (err) {
      alert(err.message);
    }
  };

  useEffect(() => {
    if (token) {
      fetchConfig();
      fetchRestrictionsAndProducts();
      fetchSageMetadata();
      fetchCollaborators();
      fetchSuppliers();
      fetchUsers();
    }
  }, [token]);

  // Handle Tab 1 save
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setConfigSuccess('');
    setConfigError('');
    try {
      const response = await fetch(`${API_BASE_URL}/Settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          commercialFilePath: commercialPath,
          accountingFilePath: accountingPath,
          username: sageUser,
          password: sagePassword,
          openAIApiKey: openAIApiKey
        })
      });
      if (!response.ok) throw new Error('Impossible de sauvegarder la configuration.');
      setConfigSuccess('Configuration SAGE enregistrée avec succès.');
      fetchConfig(); // Refresh
    } catch (err) {
      setConfigError(err.message);
    }
  };

  // Handle Tab 2 add restriction
  const handleAddRestriction = async (e) => {
    e.preventDefault();
    setRestrictionSuccess('');
    setRestrictionError('');
    setSubmittingRestriction(true);

    try {
      const response = await fetch(`${API_BASE_URL}/Settings/restrictions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          scope,
          scopeTarget,
          restrictionType,
          restrictionTarget
        })
      });
      
      if (!response.ok) throw new Error("Erreur lors de l'ajout de la restriction.");
      
      setRestrictionSuccess('Règle de restriction ajoutée avec succès.');
      fetchRestrictionsAndProducts(); // Reload
    } catch (err) {
      setRestrictionError(err.message);
    } finally {
      setSubmittingRestriction(false);
    }
  };

  // Handle Tab 2 delete restriction
  const handleDeleteRestriction = async (id) => {
    if (!confirm('Voulez-vous vraiment supprimer cette restriction ?')) return;
    try {
      const response = await fetch(`${API_BASE_URL}/Settings/restrictions/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Impossible de supprimer la restriction.');
      fetchRestrictionsAndProducts(); // Reload
    } catch (err) {
      alert(err.message);
    }
  };

  const getScopeTargetName = (scopeVal, targetVal) => {
    if (scopeVal === 'Client') {
      const client = clientsList.find(c => c.ctNum === targetVal);
      return client ? `${client.ctIntitule} (${client.ctNum})` : targetVal;
    } else {
      const cat = categoriesList.find(c => c.id.toString() === targetVal.toString());
      return cat ? `${cat.name} (Cat. ${cat.id})` : `Cat. ${targetVal}`;
    }
  };

  const getRestrictionTargetName = (typeVal, targetVal) => {
    if (typeVal === 'Family') {
      const fam = familiesList.find(f => f.code === targetVal);
      return fam ? `${fam.name} (${fam.code})` : targetVal;
    } else {
      const prod = products.find(p => p.ref === targetVal);
      return prod ? `${prod.name} (${prod.ref})` : targetVal;
    }
  };

  return (
    <Layout>
      <div className="p-4 md:p-10 max-w-7xl mx-auto w-full space-y-8 text-left">
        {/* Banner */}
        <section className="relative overflow-hidden rounded-3xl bg-primary-container p-8 text-white shadow-lg">
          <h2 className="text-[32px] font-extrabold mb-2">Configuration SAGE</h2>
          <p className="text-[16px] text-on-primary-container max-w-xl">
            Gérez les paramètres de connexion DCOM SAGE 100 et définissez les droits d'accès au catalogue.
          </p>
        </section>

        {/* Tab Controls */}
        <div className="flex border-b border-outline-variant/30">
          <button
            onClick={() => setActiveTab('sage')}
            className={`px-6 py-3 font-bold text-[15px] border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'sage'
                ? 'border-secondary text-secondary'
                : 'border-transparent text-on-surface-variant hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">database</span>
            <span>Fichiers SAGE 100</span>
          </button>
          <button
            onClick={() => setActiveTab('access')}
            className={`px-6 py-3 font-bold text-[15px] border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'access'
                ? 'border-secondary text-secondary'
                : 'border-transparent text-on-surface-variant hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
            <span>Gestion des Accès</span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-3 font-bold text-[15px] border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'users'
                ? 'border-secondary text-secondary'
                : 'border-transparent text-on-surface-variant hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">group</span>
            <span>Gestion des Comptes</span>
          </button>
        </div>

        {/* TAB 1: SAGE Configuration */}
        {activeTab === 'sage' && (
          <div className="bg-white rounded-3xl p-6 md:p-8 border border-outline-variant/30 custom-shadow max-w-3xl">
            <h3 className="text-[18px] font-bold text-primary mb-6">Paramètres de liaison COM SAGE</h3>
            
            {configLoading ? (
              <div className="py-10 text-center text-outline">
                <span className="material-symbols-outlined animate-spin text-4xl">progress_activity</span>
              </div>
            ) : (
              <form onSubmit={handleSaveConfig} className="space-y-6">
                {configSuccess && (
                  <div className="p-4 bg-success-emerald/10 text-success-emerald rounded-2xl text-[14px] font-semibold flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px]">check_circle</span>
                    <span>{configSuccess}</span>
                  </div>
                )}
                {configError && (
                  <div className="p-4 bg-error-container text-on-error-container rounded-2xl text-[14px] font-semibold flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px]">error</span>
                    <span>{configError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-6">
                  {/* GCM File Path */}
                  <div className="space-y-2">
                    <label className="block text-[14px] font-semibold text-on-surface-variant">
                      Chemin du Fichier Commercial (.gcm)
                    </label>
                    <input
                      type="text"
                      className="w-full h-12 px-4 bg-surface rounded-xl border border-outline-variant/30 text-[15px] outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                      placeholder="D:\basesage\BIJOU.gcm"
                      value={commercialPath}
                      onChange={(e) => setCommercialPath(e.target.value)}
                      required
                    />
                  </div>

                  {/* MAE File Path */}
                  <div className="space-y-2">
                    <label className="block text-[14px] font-semibold text-on-surface-variant">
                      Chemin du Fichier Comptable (.mae / .gae)
                    </label>
                    <input
                      type="text"
                      className="w-full h-12 px-4 bg-surface rounded-xl border border-outline-variant/30 text-[15px] outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                      placeholder="D:\basesage\BIJOU.mae"
                      value={accountingPath}
                      onChange={(e) => setAccountingPath(e.target.value)}
                    />
                  </div>

                  {/* SAGE credentials */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-[14px] font-semibold text-on-surface-variant">
                        Nom d'utilisateur SAGE
                      </label>
                      <input
                        type="text"
                        className="w-full h-12 px-4 bg-surface rounded-xl border border-outline-variant/30 text-[15px] outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                        placeholder="Administrateur"
                        value={sageUser}
                        onChange={(e) => setSageUser(e.target.value)}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="block text-[14px] font-semibold text-on-surface-variant">
                        Mot de passe SAGE
                      </label>
                      <input
                        type="password"
                        className="w-full h-12 px-4 bg-surface rounded-xl border border-outline-variant/30 text-[15px] outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                        placeholder={hasPassword ? '••••••••' : 'Pas de mot de passe'}
                        value={sagePassword === '__UNCHANGED__' ? '' : sagePassword}
                        onChange={(e) => setSagePassword(e.target.value)}
                      />
                      {hasPassword && (
                        <p className="text-[11px] text-outline mt-1 font-medium">
                          Saisissez un nouveau mot de passe pour le modifier, ou laissez vide pour conserver l'actuel.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* OpenAI API Key */}
                  <div className="space-y-2 pt-4 border-t border-outline-variant/20">
                    <label className="block text-[14px] font-semibold text-on-surface-variant flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px]">key</span>
                      Clé API OpenAI (modèle Vision OCR)
                    </label>
                    <input
                      type="password"
                      className="w-full h-12 px-4 bg-surface rounded-xl border border-outline-variant/30 text-[15px] outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                      placeholder={hasOpenAIApiKey ? '••••••••••••••••••••••••••••••••' : 'Saisir votre clé API OpenAI (sk-...)'}
                      value={openAIApiKey === '__UNCHANGED__' ? '' : openAIApiKey}
                      onChange={(e) => setOpenAIApiKey(e.target.value)}
                    />
                    <p className="text-[11px] text-outline mt-1 font-medium">
                      Cette clé sera utilisée par l'IA pour extraire automatiquement les lignes de commande depuis les documents (PDF/images). 
                      {hasOpenAIApiKey ? " Une clé personnalisée est actuellement enregistrée. Saisissez-en une nouvelle pour la remplacer, ou laissez vide." : " Laissez vide pour utiliser la clé par défaut du serveur."}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-outline-variant/20 flex justify-end">
                  <button
                    type="submit"
                    className="bg-secondary text-white font-bold h-12 px-8 rounded-xl hover:bg-blue-700 active:scale-98 transition-all shadow-md shadow-secondary/10"
                  >
                    Enregistrer la configuration
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* TAB 2: Access Management */}
        {activeTab === 'access' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Form to Add Restriction */}
              <div className="bg-white rounded-3xl p-6 border border-outline-variant/30 custom-shadow h-fit">
                <h3 className="text-[18px] font-bold text-primary mb-6">Ajouter une restriction</h3>
                
                {restrictionSuccess && (
                  <div className="mb-6 p-4 bg-success-emerald/10 text-success-emerald rounded-xl text-[13px] font-semibold">
                    {restrictionSuccess}
                  </div>
                )}
                {restrictionError && (
                  <div className="mb-6 p-4 bg-error-container text-on-error-container rounded-xl text-[13px] font-semibold">
                    {restrictionError}
                  </div>
                )}

                <form onSubmit={handleAddRestriction} className="space-y-4">
                  {/* Scope Select */}
                  <div className="space-y-2">
                    <label className="block text-[13px] font-semibold text-on-surface-variant">Cible de la règle</label>
                    <select
                      className="w-full h-11 px-3 bg-surface rounded-xl border border-outline-variant/30 text-[14px] outline-none"
                      value={scope}
                      onChange={(e) => {
                        const val = e.target.value;
                        setScope(val);
                        setScopeTarget(val === 'Client' ? (clientsList[0]?.ctNum || '') : (categoriesList[0]?.id?.toString() || ''));
                      }}
                    >
                      <option value="Client">Client spécifique</option>
                      <option value="PricingCategory">Catégorie Tarifaire SAGE</option>
                    </select>
                  </div>
 
                  {/* Scope Target Input */}
                  <div className="space-y-2">
                    <label className="block text-[13px] font-semibold text-on-surface-variant">Valeur de la cible</label>
                    {scope === 'Client' ? (
                      <select
                        className="w-full h-11 px-3 bg-surface rounded-xl border border-outline-variant/30 text-[14px] outline-none"
                        value={scopeTarget}
                        onChange={(e) => setScopeTarget(e.target.value)}
                      >
                        {clientsList.length === 0 ? (
                          <option value="">Aucun client trouvé</option>
                        ) : (
                          clientsList.map((c) => (
                            <option key={c.ctNum} value={c.ctNum}>
                              {c.ctIntitule} ({c.ctNum})
                            </option>
                          ))
                        )}
                      </select>
                    ) : (
                      <select
                        className="w-full h-11 px-3 bg-surface rounded-xl border border-outline-variant/30 text-[14px] outline-none"
                        value={scopeTarget}
                        onChange={(e) => setScopeTarget(e.target.value)}
                      >
                        {categoriesList.length === 0 ? (
                          <option value="">Aucune catégorie trouvée</option>
                        ) : (
                          categoriesList.map((cat) => (
                            <option key={cat.id} value={cat.id.toString()}>
                              {cat.name} (Cat. {cat.id})
                            </option>
                          ))
                        )}
                      </select>
                    )}
                  </div>
 
                  {/* Restriction Type */}
                  <div className="space-y-2">
                    <label className="block text-[13px] font-semibold text-on-surface-variant">Élément à bloquer</label>
                    <select
                      className="w-full h-11 px-3 bg-surface rounded-xl border border-outline-variant/30 text-[14px] outline-none"
                      value={restrictionType}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRestrictionType(val);
                        setRestrictionTarget(val === 'Family' ? (familiesList[0]?.code || '') : (products[0]?.ref || ''));
                      }}
                    >
                      <option value="Family">Famille d'articles</option>
                      <option value="Article">Article spécifique</option>
                    </select>
                  </div>
 
                  {/* Restriction Target Select */}
                  <div className="space-y-2">
                    <label className="block text-[13px] font-semibold text-on-surface-variant">Valeur du blocage</label>
                    {restrictionType === 'Family' ? (
                      <select
                        className="w-full h-11 px-3 bg-surface rounded-xl border border-outline-variant/30 text-[14px] outline-none"
                        value={restrictionTarget}
                        onChange={(e) => setRestrictionTarget(e.target.value)}
                      >
                        {familiesList.length === 0 ? (
                          <option value="">Aucune famille trouvée</option>
                        ) : (
                          familiesList.map((fam) => (
                            <option key={fam.code} value={fam.code}>
                              {fam.name} ({fam.code})
                            </option>
                          ))
                        )}
                      </select>
                    ) : (
                      <select
                        className="w-full h-11 px-3 bg-surface rounded-xl border border-outline-variant/30 text-[14px] outline-none"
                        value={restrictionTarget}
                        onChange={(e) => setRestrictionTarget(e.target.value)}
                      >
                        {products.length === 0 ? (
                          <option value="">Aucun article trouvé</option>
                        ) : (
                          products.map((p) => (
                            <option key={p.ref} value={p.ref}>
                              {p.name} ({p.ref})
                            </option>
                          ))
                        )}
                      </select>
                    )}
                  </div>
 
                  <button
                    type="submit"
                    disabled={submittingRestriction || metadataLoading}
                    className="w-full bg-primary text-on-primary font-bold h-11 rounded-xl active:scale-98 transition-all hover:bg-slate-800 flex items-center justify-center gap-2"
                  >
                    {submittingRestriction ? (
                      <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[18px]">block</span>
                        <span>Bloquer l'accès</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
 
              {/* List of Restrictions */}
              <div className="lg:col-span-2 bg-white rounded-3xl border border-outline-variant/30 custom-shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-outline-variant/30 bg-surface-container-low/20">
                  <h3 className="text-[18px] font-bold text-primary">Règles de restrictions d'accès actives</h3>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-surface-container-low text-on-surface-variant uppercase text-[10px] tracking-widest font-bold">
                      <tr>
                        <th className="px-6 py-4">Cible Règle</th>
                        <th className="px-6 py-4">Valeur Cible</th>
                        <th className="px-6 py-4">Type Blocage</th>
                        <th className="px-6 py-4">Élément bloqué</th>
                        <th className="px-6 py-4">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/20">
                      {restrictionsLoading ? (
                        <tr>
                          <td colSpan="5" className="px-6 py-8 text-center text-outline">
                            <span className="material-symbols-outlined animate-spin">progress_activity</span>
                          </td>
                        </tr>
                      ) : restrictions.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="px-6 py-8 text-center text-outline font-medium">
                            Aucune restriction configurée. Tous les articles sont visibles.
                          </td>
                        </tr>
                      ) : (
                        restrictions.map((rule) => (
                          <tr key={rule.id} className="hover:bg-surface-container-lowest transition-colors">
                            <td className="px-6 py-4 font-semibold text-primary">
                              {rule.scope === 'Client' ? 'Client' : 'Catégorie Tarifaire'}
                            </td>
                            <td className="px-6 py-4 text-on-surface-variant text-[14px]">
                              {getScopeTargetName(rule.scope, rule.scopeTarget)}
                            </td>
                            <td className="px-6 py-4 font-semibold">
                              {rule.restrictionType === 'Family' ? 'Famille' : 'Article'}
                            </td>
                            <td className="px-6 py-4 text-error font-bold text-[14px]">
                              {getRestrictionTargetName(rule.restrictionType, rule.restrictionTarget)}
                            </td>
                            <td className="px-6 py-4">
                              <button
                                onClick={() => handleDeleteRestriction(rule.id)}
                                className="text-outline hover:text-error transition-colors p-1 flex items-center justify-center"
                              >
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: User Accounts Management */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-[20px] font-bold text-primary">Gestion des Comptes</h3>
                <p className="text-[13px] text-outline font-medium">Créez et modifiez les comptes d'accès pour vos clients professionnels et particuliers.</p>
              </div>
              <button
                onClick={openCreateForm}
                className="bg-secondary text-white font-bold h-11 px-5 rounded-xl hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-md shadow-secondary/15"
              >
                <span className="material-symbols-outlined text-[20px]">person_add</span>
                <span>Créer un compte client</span>
              </button>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-3xl border border-outline-variant/30 custom-shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead className="bg-surface-container-low text-on-surface-variant uppercase text-[10px] tracking-widest font-bold border-b border-outline-variant/20">
                    <tr>
                      <th className="px-6 py-4">Nom / Société</th>
                      <th className="px-6 py-4">Email / Identifiant</th>
                      <th className="px-6 py-4">Rôle</th>
                      <th className="px-6 py-4">Code Client SAGE</th>
                      <th className="px-6 py-4 text-right" style={{ width: '150px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {usersLoading ? (
                      <tr>
                        <td colSpan="5" className="px-6 py-8 text-center text-outline">
                          <span className="material-symbols-outlined animate-spin text-3xl text-secondary">progress_activity</span>
                        </td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-6 py-8 text-center text-outline font-medium">
                          Aucun compte utilisateur trouvé.
                        </td>
                      </tr>
                    ) : (
                      users.map((u) => {
                        let roleBadge = 'bg-slate-100 text-slate-800';
                        let roleLabel = 'Professionnel';
                        if (u.role === 'Administrator') {
                          roleBadge = 'bg-purple-100 text-purple-800';
                          roleLabel = 'Administrateur';
                        } else if (u.role === 'Individual') {
                          roleBadge = 'bg-blue-100 text-blue-800';
                          roleLabel = 'Particulier';
                        } else if (u.role === 'Commercial') {
                          const col = collaboratorsList.find(c => c.id === u.sageCollaboratorId);
                          roleBadge = 'bg-amber-100 text-amber-800 border border-amber-200';
                          roleLabel = col ? `Commercial (${col.name})` : 'Commercial';
                        }

                        return (
                          <tr key={u.id} className="hover:bg-surface-container-lowest transition-colors">
                            <td className="px-6 py-4 font-bold text-on-surface text-[14px]">
                              {u.name}
                            </td>
                            <td className="px-6 py-4 text-on-surface-variant text-[14px]">
                              {u.email}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${roleBadge}`}>
                                {roleLabel}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-mono text-[13px] text-primary font-bold">
                              {u.role === 'Commercial' ? (
                                <span className="text-secondary font-bold font-sans">
                                  {collaboratorsList.find(c => c.id === u.sageCollaboratorId)?.name || `Collab ID: ${u.sageCollaboratorId}`}
                                </span>
                              ) : (
                                u.customerRef || <span className="text-outline font-normal font-sans italic">Non rattaché</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-end gap-3">
                                <button
                                  onClick={() => openEditForm(u)}
                                  className="text-outline hover:text-secondary transition-colors p-1 flex items-center justify-center rounded-lg hover:bg-surface-variant/40"
                                  title="Modifier le compte"
                                >
                                  <span className="material-symbols-outlined text-[18px]">edit</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(u.id, u.email)}
                                  disabled={u.id === 3}
                                  className="text-outline hover:text-error transition-colors p-1 flex items-center justify-center rounded-lg hover:bg-surface-variant/40 disabled:opacity-40 disabled:hover:text-outline"
                                  title={u.id === 3 ? "Compte système protégé" : "Supprimer le compte"}
                                >
                                  <span className="material-symbols-outlined text-[18px]">delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Modal Form for Creating / Editing User */}
        {userFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-3xl border border-outline-variant/30 custom-shadow w-full max-w-md overflow-hidden">
              <div className="px-6 py-4 bg-surface-container-low border-b border-outline-variant/20 flex items-center justify-between">
                <h3 className="text-[17px] font-bold text-primary">
                  {editingUser ? `Modifier l'utilisateur` : 'Créer un compte client'}
                </h3>
                <button
                  onClick={() => setUserFormOpen(false)}
                  className="text-outline hover:text-on-surface p-1 rounded-full hover:bg-surface-variant/30 transition-all flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <form onSubmit={handleSaveUser} className="p-6 space-y-4 text-left">
                {userFormSuccess && (
                  <div className="p-3 bg-success-emerald/10 text-success-emerald rounded-xl text-[13px] font-semibold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    <span>{userFormSuccess}</span>
                  </div>
                )}
                {userFormError && (
                  <div className="p-3 bg-error-container text-on-error-container rounded-xl text-[13px] font-semibold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px]">error</span>
                    <span>{userFormError}</span>
                  </div>
                )}

                {/* Nom */}
                <div className="space-y-1.5">
                  <label className="block text-[13px] font-semibold text-on-surface-variant">Nom / Raison Sociale</label>
                  <input
                    type="text"
                    required
                    className="w-full h-11 px-3 bg-surface rounded-xl border border-outline-variant/30 text-[14px] outline-none focus:border-secondary"
                    placeholder="Ex: PLM TECH INFO"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                  />
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="block text-[13px] font-semibold text-on-surface-variant">Adresse Email (Identifiant)</label>
                  <input
                    type="email"
                    required
                    className="w-full h-11 px-3 bg-surface rounded-xl border border-outline-variant/30 text-[14px] outline-none focus:border-secondary"
                    placeholder="client@domaine.com"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                  />
                </div>

                {/* Rôle */}
                <div className="space-y-1.5">
                  <label className="block text-[13px] font-semibold text-on-surface-variant">Rôle d'accès</label>
                  <select
                    className="w-full h-11 px-3 bg-surface rounded-xl border border-outline-variant/30 text-[14px] outline-none"
                    value={userRole}
                    onChange={(e) => {
                      const val = e.target.value;
                      setUserRole(val);
                      if (val === 'Administrator') {
                        setUserCustomerRef('ADV_SAGE');
                      } else if (val === 'Commercial') {
                        setUserCustomerRef('');
                        setUserCollaboratorId(collaboratorsList[0]?.id?.toString() || '');
                      } else {
                        setUserCustomerRef(clientsList[0]?.ctNum || '');
                      }
                    }}
                  >
                    <option value="Professional">Professionnel (Distributeur)</option>
                    <option value="Individual">Particulier (Comptoir)</option>
                    <option value="Commercial">Commercial (Ventes Sage)</option>
                    <option value="Administrator">Administrateur (ADV)</option>
                  </select>
                </div>

                {/* Collaborateur SAGE (Seulement pour Commercial) */}
                {userRole === 'Commercial' && (
                  <div className="space-y-1.5 animate-fade-in">
                    <label className="block text-[13px] font-semibold text-on-surface-variant">Liaison Collaborateur SAGE 100</label>
                    <select
                      required
                      className="w-full h-11 px-3 bg-surface rounded-xl border border-outline-variant/30 text-[14px] outline-none font-bold text-primary"
                      value={userCollaboratorId}
                      onChange={(e) => setUserCollaboratorId(e.target.value)}
                    >
                      <option value="">Sélectionner un collaborateur...</option>
                      {collaboratorsList.map((col) => (
                        <option key={col.id} value={col.id}>
                          {col.name} ({col.function || 'Commercial'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Fournisseur SAGE par défaut (Seulement pour Commercial) */}
                {userRole === 'Commercial' && (
                  <div className="space-y-1.5 animate-fade-in">
                    <label className="block text-[13px] font-semibold text-on-surface-variant">Fournisseur SAGE par défaut (demande d'achat)</label>
                    <select
                      required={userRole === 'Commercial'}
                      className="w-full h-11 px-3 bg-surface rounded-xl border border-outline-variant/30 text-[14px] outline-none font-bold text-primary font-mono"
                      value={userSageSupplierRef}
                      onChange={(e) => setUserSageSupplierRef(e.target.value)}
                    >
                      <option value="">Sélectionner un fournisseur...</option>
                      {suppliersList.map((sup) => (
                        <option key={sup.ref} value={sup.ref}>
                          {sup.ref} - {sup.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Code Client SAGE */}
                {userRole !== 'Commercial' && (
                  <div className="space-y-1.5">
                    <label className="block text-[13px] font-semibold text-on-surface-variant">Rattachement Client SAGE 100</label>
                    {userRole === 'Administrator' ? (
                      <input
                        type="text"
                        readOnly
                        className="w-full h-11 px-3 bg-surface-variant/40 rounded-xl border border-outline-variant/30 text-[14px] outline-none cursor-not-allowed font-mono text-primary font-bold"
                        value={userCustomerRef}
                      />
                    ) : (
                      <select
                        className="w-full h-11 px-3 bg-surface rounded-xl border border-outline-variant/30 text-[14px] outline-none font-mono font-bold text-primary"
                        value={userCustomerRef}
                        onChange={(e) => setUserCustomerRef(e.target.value)}
                      >
                        {clientsList.length === 0 ? (
                          <option value="">Aucun tiers SAGE trouvé</option>
                        ) : (
                          clientsList.map((c) => (
                            <option key={c.ctNum} value={c.ctNum}>
                              {c.ctNum} - {c.ctIntitule}
                            </option>
                          ))
                        )}
                      </select>
                    )}
                  </div>
                )}

                {/* Catalogues / Familles Autorisés */}
                <div className="space-y-1.5 col-span-1 md:col-span-2">
                  <label className="block text-[13px] font-semibold text-on-surface-variant">Catalogues/Familles Autorisés (Visibilité)</label>
                  <p className="text-[11px] text-outline italic">
                    Cochez les familles autorisées pour cet utilisateur. Si aucune n'est cochée, tout le catalogue est visible par défaut.
                  </p>
                  <div className="mt-1 max-h-36 overflow-y-auto border border-outline-variant/30 rounded-xl p-3 bg-surface grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {familiesList.map((f) => {
                      const isChecked = userAllowedCategories.includes(f.code) || userAllowedCategories.includes(f.name);
                      return (
                        <label key={f.code} className="flex items-center gap-2 text-[13px] font-medium text-primary cursor-pointer hover:bg-surface-variant/20 p-1.5 rounded-lg">
                          <input
                            type="checkbox"
                            className="rounded border-outline-variant/50 text-secondary focus:ring-secondary w-4 h-4"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setUserAllowedCategories([...userAllowedCategories, f.code]);
                              } else {
                                setUserAllowedCategories(userAllowedCategories.filter(c => c !== f.code && c !== f.name));
                              }
                            }}
                          />
                          <span>{f.name} <span className="text-outline text-[11px]">({f.code})</span></span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Mot de passe */}
                <div className="space-y-1.5">
                  <label className="block text-[13px] font-semibold text-on-surface-variant">
                    {editingUser ? 'Nouveau mot de passe (laisser vide pour conserver)' : 'Mot de passe'}
                  </label>
                  <input
                    type="password"
                    required={!editingUser}
                    className="w-full h-11 px-3 bg-surface rounded-xl border border-outline-variant/30 text-[14px] outline-none focus:border-secondary"
                    placeholder="••••••••"
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                  />
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-outline-variant/20 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setUserFormOpen(false)}
                    className="px-5 h-11 border border-outline-variant/50 rounded-xl text-[14px] font-semibold text-on-surface hover:bg-surface-variant/30 active:scale-98 transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-5 h-11 bg-secondary text-white font-bold rounded-xl hover:bg-blue-700 active:scale-98 transition-all shadow-md shadow-secondary/15"
                  >
                    Sauvegarder
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
