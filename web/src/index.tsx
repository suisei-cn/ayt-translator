import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import * as serviceWorker from './serviceWorker';

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';

import { initializeIcons } from '@fluentui/react/lib/Icons';

import 'office-ui-fabric-react/dist/css/fabric.css';

initializeIcons();

i18n
  .use(HttpBackend)
  .use(initReactI18next)
  .use(LanguageDetector)
  .init({
    fallbackLng: 'en',
    detection: {
      lookupQuerystring: 'lang',
    },
    backend: {
      loadPath: '/i18n.{{lng}}.json',
    },
    react: {
      useSuspense: false,
    },
    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

ReactDOM.render(
  <App />,
  document.getElementById('root')
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
