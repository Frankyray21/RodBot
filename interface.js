/* Aides d'interface. Aucun contenu de quiz ni aucune requête vers le registre. */
(function (root) {
  'use strict';
  function normalize(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function searchLessons(modules, query, mapPage) {
    var words = normalize(query).split(' ').filter(Boolean);
    if (!words.length) return [];
    var results = [];
    modules.forEach(function (module, mi) {
      module.sections.forEach(function (lesson, si) {
        var page = mapPage ? mapPage(lesson.page) : lesson.page;
        var haystack = normalize(module.title + ' ' + (module.short || '') + ' ' + lesson.title + ' page ' + page);
        if (words.every(function (word) { return haystack.indexOf(word) !== -1; })) results.push({ module: mi, lesson: si, title: lesson.title, moduleTitle: module.title, page: page });
      });
    });
    return results;
  }
  var before = null, view = '', modalType = '', modalReturns = {}, component = null, panelOpen = false, panelReturn = null;
  function viewKey(c) { return [c.state.view, c.state.activeId, c.state.lang].join('|'); }
  function focus(element) { if (element) { try { element.focus({ preventScroll: true }); } catch (_) { element.focus(); } } }
  function beforeRender(app, c) {
    component = c;
    var active = document.activeElement;
    before = { inside: !!(active && app.contains(active)), key: active && active.getAttribute('data-rb-focus'), remoteSpot: !!(active && active.classList.contains('rb-spot')), view: view };
  }
  function activeModal(app) {
    if (!app) return null;
    return Array.from(app.querySelectorAll('[data-rb-dialog]')).filter(function (el) { return el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden'; }).sort(function (a, b) { return Number(b.style.zIndex) - Number(a.style.zIndex); })[0] || null;
  }
  function afterRender(app, c) {
    component = c;
    var currentView = viewKey(c), changed = view && view !== currentView;
    view = currentView;
    var dialog = activeModal(app), nextType = dialog ? dialog.dataset.rbDialog : '';
    var key = before && before.key;
    if (before && before.remoteSpot) panelReturn = before.key;
    if (panelOpen && !c.state.rrcInfoOpen) key = panelReturn || key;
    panelOpen = !!c.state.rrcInfoOpen;
    if (modalType && modalType !== nextType && !app.querySelector('[data-rb-dialog="' + modalType + '"]')) {
      key = modalReturns[modalType] || key;
      delete modalReturns[modalType];
    }
    if (nextType && nextType !== modalType && !Object.prototype.hasOwnProperty.call(modalReturns, nextType)) modalReturns[nextType] = before && before.key;
    app.querySelectorAll('main h1').forEach(function (heading) { heading.tabIndex = -1; });
    app.querySelectorAll('[data-rb-inert]').forEach(function (node) { node.inert = false; node.removeAttribute('data-rb-inert'); });
    if (dialog) {
      dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true');
      var names = { manual: ['Manuel de l’opérateur', 'Operator manual'], image: ['Image agrandie', 'Enlarged image'], remote: ['Commande de la télécommande', 'Remote control command'], install: ['Installer l’application', 'Install the app'] };
      dialog.setAttribute('aria-label', (names[nextType] || ['Information','Information'])[c.state.lang === 'en' ? 1 : 0]);
      var branch = dialog;
      while (branch && branch !== app) {
        Array.from(branch.parentElement.children).forEach(function (node) { if (node !== branch) { node.inert = true; node.setAttribute('data-rb-inert', ''); } });
        branch = branch.parentElement;
      }
      var close = Array.from(dialog.querySelectorAll('button')).find(function (button) { return button.textContent.trim() === '✕'; });
      if (close) close.setAttribute('aria-label', c.state.lang === 'en' ? 'Close' : 'Fermer');
      var restore = key && Array.from(dialog.querySelectorAll('[data-rb-focus]')).find(function (el) { return el.dataset.rbFocus === key; });
      focus(restore || close || dialog.querySelector('button, a'));
    } else if (modalType || (before && before.inside && !changed)) {
      var target = key && Array.from(app.querySelectorAll('[data-rb-focus]')).find(function (el) { return el.dataset.rbFocus === key; });
      if (target && !target.disabled) focus(target);
      else if (before && before.inside) focus(app.querySelector('main h1, main'));
    } else if (changed && (!document.querySelector('dialog[open]'))) {
      var heading = app.querySelector('main h1, main');
      if (heading) { heading.tabIndex = -1; focus(heading); }
    }
    modalType = nextType;
    document.querySelectorAll('.rb-skip').forEach(function (link) { link.textContent = c.state.lang === 'en' ? 'Skip to content' : 'Aller au contenu'; });
  }
  function openSearch(c) {
    if (document.getElementById('rb-search')) return;
    var en = c.state.lang === 'en', opener = document.activeElement;
    var dialog = document.createElement('dialog'); dialog.id = 'rb-search'; dialog.className = 'rb-search-dialog';
    dialog.setAttribute('aria-labelledby', 'rb-search-title');
    dialog.innerHTML = '<div class="rb-search-head"><h2 id="rb-search-title"></h2><button class="rb-search-close" type="button">✕</button></div><label for="rb-search-input"></label><input class="rb-search-input" id="rb-search-input" type="search" autocomplete="off"><p class="rb-search-count" role="status" aria-live="polite"></p><div class="rb-search-results"></div>';
    dialog.querySelector('h2').textContent = en ? 'Find a lesson' : 'Trouver une leçon';
    dialog.querySelector('label').textContent = en ? 'Topic or manual page' : 'Sujet ou page du manuel';
    var input = dialog.querySelector('input'); input.placeholder = en ? 'Remote, brakes, page 18…' : 'Télécommande, freins, page 18…';
    var close = dialog.querySelector('button'); close.setAttribute('aria-label', en ? 'Close search' : 'Fermer la recherche');
    close.addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('close', function () { dialog.remove(); if (opener && opener.isConnected) focus(opener); });
    var list = dialog.querySelector('.rb-search-results'), count = dialog.querySelector('.rb-search-count');
    function update() {
      list.replaceChildren();
      if (!input.value.trim()) { count.textContent = en ? 'Search lesson titles. Quiz answers are not included.' : 'Recherchez dans les titres. Les réponses aux quiz sont exclues.'; return; }
      var results = searchLessons(c.M(), input.value, c.mp.bind(c));
      count.textContent = results.length ? results.length + (en ? ' lessons found.' : ' leçons trouvées.') : (en ? 'No lesson found. Try another word.' : 'Aucune leçon trouvée. Essayez un autre mot.');
      results.forEach(function (result) {
        var button = document.createElement('button'); button.type = 'button'; button.className = 'rb-search-result';
        var label = document.createElement('strong'), meta = document.createElement('span'); label.textContent = result.title;
        meta.textContent = (en ? 'Module ' : 'Module ') + (result.module + 1) + ' · ' + result.moduleTitle + ' · p. ' + result.page;
        button.append(label, meta);
        button.addEventListener('click', function () { dialog.close(); c.openLesson(result.module, result.lesson); });
        list.appendChild(button);
      });
    }
    input.addEventListener('input', update); document.body.appendChild(dialog); update(); dialog.showModal(); input.focus();
  }
  if (typeof document === 'object') {
    document.addEventListener('keydown', function (event) {
      if (!component || document.querySelector('dialog[open]') || component._tourStep != null) return;
      var modal = activeModal(document.getElementById('app'));
      if (modal && event.key === 'Escape') {
        var actions = { manual: 'closeManual', image: 'closeImg', remote: 'closeRrcInfo', install: 'closeInstallHelp' };
        var action = actions[modal.dataset.rbDialog];
        if (action && component[action]) { event.preventDefault(); event.stopImmediatePropagation(); component[action](); }
      } else if (modal && event.key === 'Tab') {
        var controls = Array.from(modal.querySelectorAll('button:not([disabled]), a[href], input, textarea, select')).filter(function (el) { return el.getClientRects().length && !el.closest('[inert]'); });
        var first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); focus(last); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); focus(first); }
      } else if (!modal && event.key === 'Escape' && component.state.rrcInfoOpen) {
        event.preventDefault(); component.closeRrcInfo();
      } else if (!modal && event.key === '/' && !event.ctrlKey && !event.metaKey && !/INPUT|TEXTAREA|SELECT/.test(event.target.tagName) && !event.target.isContentEditable) {
        event.preventDefault(); openSearch(component);
      }
    }, true);
  }
  root.RBInterface = { beforeRender: beforeRender, afterRender: afterRender, openSearch: openSearch, searchLessons: searchLessons, normalize: normalize };
  if (typeof module === 'object' && module.exports) module.exports = root.RBInterface;
})(typeof window === 'object' ? window : globalThis);
