'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    if (!user) return;

    async function fetchNotifications() {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);
      setNotifications(data || []);
    }

    fetchNotifications();

    const channel = supabase
      .channel('notifications_realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setNotifications(prev => [payload.new, ...prev]);
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [user]);

  // 외부 클릭 시 닫기
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleOpen() {
    const next = !isOpen;
    setIsOpen(next);
    if (next && unreadCount > 0) {
      // 읽음 처리
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    }
  }

  if (!user) return null;

  return (
    <div className="notif-bell" ref={dropdownRef}>
      <button className="notif-bell__btn" onClick={handleOpen} title="알림">
        🔔
        {unreadCount > 0 && (
          <span className="notif-bell__badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notif-dropdown">
          <div className="notif-dropdown__header">알림</div>
          {notifications.length === 0 ? (
            <p className="notif-dropdown__empty">새로운 알림이 없어요</p>
          ) : (
            <div className="notif-dropdown__list">
              {notifications.map(n => (
                <a
                  key={n.id}
                  href="/forum"
                  className={`notif-item ${!n.is_read ? 'notif-item--unread' : ''}`}
                  onClick={() => setIsOpen(false)}
                >
                  <span className="notif-item__icon">
                    {n.type === 'mention' ? '🏷️' : '💬'}
                  </span>
                  <div className="notif-item__body">
                    <p className="notif-item__msg">{n.message}</p>
                    <span className="notif-item__time">{timeAgo(n.created_at)}</span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
