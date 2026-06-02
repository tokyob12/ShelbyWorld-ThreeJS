// inject standard Buffer polyfill for Web3 SDK compatibility
import { Buffer } from 'buffer';
window.Buffer = Buffer;
globalThis.Buffer = Buffer;

import React from 'react'
import ReactDOM from 'react-dom/client'
import { KeyboardControls } from '@react-three/drei'
import App from './App.jsx'
import './App.css'

const keyboardMap = [
  { name: 'forward', keys: ['ArrowUp', 'KeyW', 'w', 'W'] },
  { name: 'backward', keys: ['ArrowDown', 'KeyS', 's', 'S'] },
  { name: 'left', keys: ['ArrowLeft', 'KeyA', 'a', 'A'] }, 
  { name: 'right', keys: ['ArrowRight', 'KeyD', 'd', 'D'] }, 
  { name: 'strafeLeft', keys: ['KeyQ', 'q', 'Q'] }, 
  { name: 'strafeRight', keys: ['KeyE', 'e', 'E'] }, 
  { name: 'jump', keys: ['Space'] },
  { name: 'boost', keys: ['ShiftLeft', 'ShiftRight', 'Shift'] },
]

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <KeyboardControls map={keyboardMap}>
      <App />
    </KeyboardControls>
  </React.StrictMode>,
)