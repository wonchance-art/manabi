'use client';
import {createContext} from 'react';

// UI display only. Source language, canonical token fields and explanation locale stay separate.
export const ViewerUiLocaleContext = createContext('ko');
export const ViewerUiLocaleProvider = ViewerUiLocaleContext.Provider;
