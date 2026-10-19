import React, { useState, useEffect, useCallback } from 'react';
import { AuthContext } from './authContextValue';
import { authApi } from '../api/client';
import { getSocket, joinUserRoom, leaveUserRoom } from '../api/socket';

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  const refreshUser = useCallback(async () => {
    try {
      const res = await authApi.getCurrentUser();
      const userData = res?.data || res;
      setCurrentUser(userData);
      return userData;
    } catch {
      setCurrentUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const initAuth = async () => {
      try {
        const res = await authApi.getCurrentUser();
        if (mounted) {
          const userData = res?.data || res;
          setCurrentUser(userData);
        }
      } catch {
        if (mounted) {
          setCurrentUser(null);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();
    return () => {
      mounted = false;
    };
  }, []);

  // Socket room joining for real-time notifications
  useEffect(() => {
    if (!currentUser?._id) return;

    const socket = getSocket();
    joinUserRoom(currentUser._id);

    const handleNotification = () => {
      setUnreadNotificationsCount((prev) => prev + 1);
    };

    socket.on('notification', handleNotification);

    return () => {
      leaveUserRoom(currentUser._id);
      socket.off('notification', handleNotification);
    };
  }, [currentUser?._id]);

  const login = async (credentials) => {
    const res = await authApi.login(credentials);
    await refreshUser();
    return res;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.warn('Logout error', err);
    } finally {
      setCurrentUser(null);
    }
  };

  const logoutAll = async () => {
    try {
      await authApi.logoutAll();
    } catch (err) {
      console.warn('Logout all error', err);
    } finally {
      setCurrentUser(null);
    }
  };

  const value = {
    currentUser,
    isAuthenticated: !!currentUser,
    isLoading,
    refreshUser,
    login,
    logout,
    logoutAll,
    unreadNotificationsCount,
    setUnreadNotificationsCount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
