'use client';
import {Component, useEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import dynamic from 'next/dynamic';
import './teaching-board.css';

const Canvas = dynamic(() => import('./TeachingBoardCanvas'), {ssr: false, loading: () => <p className="teaching-board-loading" role="status">설명판을 펼치고 있어요…</p>});

class BoardBoundary extends Component {
  state = {error: false};
  static getDerivedStateFromError() { return {error: true}; }
  render() {
    return this.state.error ? <div className="teaching-board-loading" role="alert"><p>설명판을 열지 못했어요. 교재로 돌아가 다시 시도해 주세요.</p><button onClick={this.props.onClose}>교재로 돌아가기</button></div> : this.props.children;
  }
}

export default function TeachingBoard({target, headerTarget, onLayout, onClose, ...props}) {
  const [host, setHost] = useState(null);
  useEffect(() => { setHost(target?.current); onLayout('split'); return () => onLayout(''); }, [target, onLayout]);
  if (!host) return null;
  return createPortal(<BoardBoundary onClose={onClose}><Canvas {...props} headerHost={headerTarget?.current} onLayout={onLayout} onClose={onClose}/></BoardBoundary>, host);
}
