// ==UserScript==
// @name         suisei-cn auto translator
// @namespace    http://suisei.moe/
// @version      0.1
// @description  suisei-cn auto translator
// @author       You
// @match        https://twitter.com/*
// @grant        GM_xmlhttpRequest
// @run-at       document-end
// @connect      localhost
// ==/UserScript==

(function () {
  'use strict';

  let translateSpan = null;
  let translatedText = null;

  let acceptableTexts = ['Translate Tweet', '翻译推文'];

  document.body.addEventListener('click', event => {
    if (acceptableTexts.indexOf(event.target.textContent) !== -1) {
      translateSpan = event.target;
      let text = event.target.parentNode.previousSibling.textContent;
      translateSpan.textContent = 'Translating...';
      GM_xmlhttpRequest({
        method: "POST",
        url: "http://localhost:3001/translate?to=zh",
        data: JSON.stringify({text}),
        headers: {
          "Content-Type": "application/json"
        },
        onload: function (resp) {
          let response = JSON.parse(resp.responseText);
          if (response.translation) {
            translatedText = document.createElement('div');
            translatedText
            translatedText.textContent = response.translation;
            translatedText.className = translateSpan.parentNode.previousSibling.className;
            translateSpan.textContent = 'Translated by suisei-cn Auto Translator';
            translateSpan.parentNode.insertAdjacentElement('afterend', translatedText);
          } else {
            translateSpan.textContent = 'Translate Tweet';
          }
        }
      });
      event.stopPropagation();
    } else if (event.target.textContent == 'Translated by suisei-cn Auto Translator') {
      if (translatedText) {
        translatedText.parentNode.removeChild(translatedText);
      }
      if (translateSpan) {
        translateSpan.textContent = 'Translate Tweet';
      }
      translateSpan = null;
      translatedText = null;
      event.stopPropagation();
    }
  });
})();