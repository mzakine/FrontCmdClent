import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth, API_BASE_URL } from './AuthContext';

const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);
  const { selectedClient, token, user } = useAuth();

  // Load cart on mount
  useEffect(() => {
    const storedCart = localStorage.getItem('cart');
    if (storedCart) {
      try {
        setCartItems(JSON.parse(storedCart));
      } catch (e) {
        console.error('Error loading cart', e);
      }
    }
  }, []);

  // Recalculate prices when ADV changes selected client
  useEffect(() => {
    if (!token || cartItems.length === 0 || user?.role !== 'Administrator') return;

    const recalculatePrices = async () => {
      try {
        const customerRef = selectedClient ? selectedClient.ref : 'CLIENT_PARTICULIER';
        const response = await fetch(`${API_BASE_URL}/Catalog/validate-import`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            customerRef: customerRef,
            items: cartItems.map(item => ({ code: item.ref, quantity: item.quantity }))
          })
        });

        if (response.ok) {
          const validated = await response.json();
          let changed = false;
          const updatedItems = cartItems.map(item => {
            const match = validated.find(v => v.productRef.toLowerCase() === item.ref.toLowerCase());
            if (match && match.isValid && match.proPrice !== item.price) {
              changed = true;
              return { 
                ...item, 
                price: match.proPrice 
              };
            }
            return item;
          });
          if (changed) {
            saveCart(updatedItems);
          }
        }
      } catch (err) {
        console.error("Erreur lors du recalcul des tarifs panier:", err);
      }
    };

    recalculatePrices();
  }, [selectedClient, token, user]);

  // Save cart on change
  const saveCart = (items) => {
    setCartItems(items);
    localStorage.setItem('cart', JSON.stringify(items));
  };

  const addToCart = (product, qty = 1) => {
    const existingIndex = cartItems.findIndex((item) => item.ref === product.ref);
    if (existingIndex > -1) {
      const updated = [...cartItems];
      updated[existingIndex].quantity += qty;
      saveCart(updated);
    } else {
      // Determine correct price: we use proPrice if it exists, otherwise publicPrice
      const price = product.proPrice !== undefined ? product.proPrice : product.publicPrice;
      saveCart([...cartItems, {
        ref: product.ref,
        name: product.name,
        price: price,
        imageUrl: product.imageUrl,
        stockQuantity: product.stockQuantity,
        category: product.category,
        quantity: qty
      }]);
    }
  };

  const removeFromCart = (productRef) => {
    saveCart(cartItems.filter((item) => item.ref !== productRef));
  };

  const updateQuantity = (productRef, qty) => {
    if (qty < 1) return;
    const updated = cartItems.map((item) => {
      if (item.ref === productRef) {
        return { ...item, quantity: qty };
      }
      return item;
    });
    saveCart(updated);
  };

  const clearCart = () => {
    saveCart([]);
  };

  const getItemsCount = () => {
    return cartItems.reduce((acc, item) => acc + item.quantity, 0);
  };

  const getCartTotal = () => {
    return cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  };

  const value = {
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getItemsCount,
    getCartTotal
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
