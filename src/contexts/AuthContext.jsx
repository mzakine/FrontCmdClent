import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const API_BASE_URL = window.APP_CONFIG?.API_BASE_URL || 'http://localhost:5078/api';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedClient, setSelectedClientState] = useState(() => {
    const stored = localStorage.getItem('selectedClient');
    return stored ? JSON.parse(stored) : null;
  });

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser && token) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, [token]);

  const setSelectedClient = (client) => {
    setSelectedClientState(client);
    if (client) {
      localStorage.setItem('selectedClient', JSON.stringify(client));
    } else {
      localStorage.removeItem('selectedClient');
    }
  };

  const clearSelectedClient = () => {
    setSelectedClient(null);
  };

  const login = async (email, password) => {
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/Auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Identifiants incorrects.');
      }

      const data = await response.json();
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      return data.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('selectedClient');
    setToken(null);
    setUser(null);
    setSelectedClientState(null);
  };

  const value = {
    user,
    token,
    loading,
    error,
    login,
    logout,
    selectedClient,
    setSelectedClient,
    clearSelectedClient,
    isAuthenticated: !!token,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
