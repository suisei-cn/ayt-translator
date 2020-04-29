// ==UserScript==
// @name         suisei-cn/ayt-translator
// @namespace    https://github.com/suisei-cn/ayt-translator
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
  let knownEmojis = {};

  function extractText(element) {
    if (element.nodeName === '#text') {
      return element.textContent;
    }
    if (element.nodeName === 'IMG') {
      let match = /emoji\/v2\/svg\/([0-9a-f]+)\.svg$/.exec(element.src);
      if (match) {
        let codepoint = String.fromCodePoint(parseInt(match[1], 16));
        knownEmojis[codepoint] = [new RegExp(codepoint, 'g'), element.src];
        element.alt = codepoint;
        return codepoint;
      }
      return '';
    }
    let builder = '';
    for (let child of element.childNodes) {
      builder += extractText(child);
    }
    return builder;
  }

  document.body.addEventListener('click', event => {
    if (acceptableTexts.indexOf(event.target.textContent) !== -1) {
      translateSpan = event.target;
      let text = extractText(event.target.parentNode.previousSibling);
      translateSpan.textContent = 'Translating...';
      GM_xmlhttpRequest({
        method: "POST",
        url: "http://localhost:3001/translate?to=zh",
        data: JSON.stringify({ text }),
        headers: {
          "Content-Type": "application/json"
        },
        onload: function (resp) {
          let response = JSON.parse(resp.responseText);
          if (response.translation) {
            translatedText = document.createElement('div');
            translatedText.textContent = response.translation;
            translatedText.className = translateSpan.parentNode.previousSibling.className;

            // Re-enable emojis
            let html = translatedText.innerHTML;
            for (let key in knownEmojis) {
              let [a, b] = knownEmojis[key];
              html = html.replace(a, `<img alt="${key}" src="${b}" style="top:0.2em;height:1.2em;position:relative;"></img>`);
            }
            translatedText.innerHTML = html;

            translatedText.style.fontFamily = 'auto';
            translateSpan.textContent = 'Translated by suisei-cn/ayt-translator';
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