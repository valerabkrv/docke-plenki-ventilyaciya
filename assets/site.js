/* Döcke плёнки, мембраны и вентиляция — рендер каталога.
   Плитки + модальное окно; данные лежат в assets/data.js. */

/* На GitHub Pages сайт лежит целиком и пути в data.js относительные.
   В блоке T123 страницу отдаёт Тильда, а картинки и скрипты остаются на
   Pages — тогда блок заранее кладёт адрес Pages в window.DK_ASSET_BASE,
   и все относительные пути склеиваются с ним. */
var DK_BASE = (typeof window !== 'undefined' && typeof window.DK_ASSET_BASE === 'string')
  ? window.DK_ASSET_BASE : '';

function asset(p) {
  if (!p || !DK_BASE || p.indexOf('http') === 0 || p.indexOf('//') === 0) return p;
  return DK_BASE + p;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function priceHtml(m) {
  if (!m.price) return '<span class="price price-ask">Цена по запросу</span>';
  return '<span class="price">от ' + esc(m.price) + ' <small>' + esc(m.unit || '') + '</small></span>';
}

/* Цены из блока T123 (DK_PRICES) перекрывают то, что лежит в data.js.
   Ключ — точное название модели; неизвестный ключ пишет предупреждение
   в консоль, иначе опечатку в названии не заметить. */
function applyPrices(map, unit, lists) {
  if (!map) return;
  var known = {};
  lists.forEach(function (list) {
    (list || []).forEach(function (m) {
      known[m.name] = true;
      if (Object.prototype.hasOwnProperty.call(map, m.name)) {
        m.price = String(map[m.name]).trim();
        if (unit) m.unit = unit;
      }
    });
  });
  Object.keys(map).forEach(function (k) {
    if (!known[k]) console.warn('DK_PRICES: позиция «' + k + '» не найдена — проверьте название');
  });
}

/* Реестр моделей: ключ «раздел-slug» -> модель. Нужен и плиткам, и окну. */
var MODEL_INDEX = {};

/* ---------- плитка ---------- */
function modelTile(key, m) {
  var chips = (m.colors || []).slice(0, 6).map(function (c) {
    return '<span class="chip" style="background:' + c.hex + '" title="' + esc(c.name) + '"></span>';
  }).join('');

  return '<a href="#' + key + '" class="model-tile" data-key="' + key + '">' +
    '<span class="model-tile-media">' +
      '<img class="docke-badge" src="' + asset('assets/images/docke-logo.svg') + '" alt="Döcke">' +
      '<img src="' + asset(m.hero) + '" alt="' + esc(m.name) + '" loading="lazy">' +
      '<span class="model-tile-hint">Подробнее</span>' +
    '</span>' +
    '<span class="model-tile-body">' +
      '<span class="model-tile-name">' + esc(m.name) + '</span>' +
      '<span class="model-tile-short">' + esc(m.short) + '</span>' +
      (chips ? '<span class="chips">' + chips + '</span>' : '') +
      '<span class="model-tile-meta">' + priceHtml(m) +
        '<span class="width">' + esc(m.meta || '') + '</span>' +
      '</span>' +
    '</span>' +
  '</a>';
}

/* Раздел рисуется группами: подзаголовок + своя сетка плиток. */
function renderSection(sectionId, models) {
  var host = document.getElementById(sectionId + '-grid');
  if (!host || !models || !models.length) return;

  var order = [], byGroup = {};
  models.forEach(function (m) {
    MODEL_INDEX[sectionId + '-' + m.slug] = { m: m, tag: m.group };
    if (!byGroup[m.group]) { byGroup[m.group] = []; order.push(m.group); }
    byGroup[m.group].push(m);
  });

  host.innerHTML = order.map(function (g, gi) {
    return '<h3 class="group-heading" id="' + sectionId + '-g' + (gi + 1) + '">' + esc(g) +
      '<span class="count-badge">' + byGroup[g].length + '</span></h3>' +
      '<div class="model-grid">' + byGroup[g].map(function (m) {
        return modelTile(sectionId + '-' + m.slug, m);
      }).join('') + '</div>';
  }).join('');
}

/* ---------- содержимое окна ---------- */
function modelDetailHtml(key) {
  var rec = MODEL_INDEX[key];
  if (!rec) return '';
  var m = rec.m;

  var propsHtml = (m.props || []).map(function (p) {
    return '<div><span class="k">' + esc(p[0]) + '</span><span class="v">' + esc(p[1]) + '</span></div>';
  }).join('');

  var colors = m.colors || [];
  var swatches = !colors.length ? '' :
    '<div class="color-row"><span class="color-row-label">Цвет:</span>' +
      '<span class="color-row-name" id="modal-color">' + esc(colors[0].name) + '</span></div>' +
    '<div class="color-swatches">' + colors.map(function (c, i) {
      return '<button type="button" class="color-swatch' + (i === 0 ? ' is-active' : '') + '"' +
        ' style="background:' + c.hex + '" data-img="' + asset(c.src) + '" data-name="' + esc(c.name) + '"' +
        ' title="' + esc(c.name) + '" aria-label="' + esc(c.name) + '"></button>';
    }).join('') + '</div>';

  return '<div class="collection-head">' +
      '<div class="collection-hero-col">' +
        '<div class="collection-hero">' +
          '<img class="docke-badge" src="' + asset('assets/images/docke-logo.svg') + '" alt="Döcke">' +
          '<img class="model-modal-photo" src="' + asset(m.hero) + '" alt="' + esc(m.name) + '">' +
        '</div>' +
        swatches +
        '<a href="#contacts" class="btn">Где купить</a>' +
      '</div>' +
      '<div class="collection-head-text">' +
        '<span class="collection-tag">' + esc(rec.tag) + '</span>' +
        '<div class="collection-title-row">' +
          '<h3 class="section-title collection-title" style="font-size:22px">' + esc(m.name) + '</h3>' +
          (m.price
            ? '<div class="collection-price">Цена от <span>' + esc(m.price) + '</span> ' + esc(m.unit || '') + '</div>'
            : '') +
        '</div>' +
        '<p class="section-sub">' + esc(m.desc) + '</p>' +
        '<div class="model-props">' + propsHtml + '</div>' +
        (m.note ? '<p class="model-note">' + esc(m.note) + '</p>' : '') +
      '</div>' +
    '</div>';
}

/* ---------- окно ---------- */
var MODAL = null;          // корневой элемент окна
var MODAL_PUSHED = false;  // добавляли ли мы запись в историю
var MODAL_SCROLL = null;   // сохранённые inline-стили overflow

function modalRoot() {
  if (MODAL) return MODAL;
  MODAL = document.createElement('div');
  MODAL.className = 'model-modal';
  MODAL.setAttribute('role', 'dialog');
  MODAL.setAttribute('aria-modal', 'true');
  MODAL.innerHTML =
    '<div class="model-modal-backdrop" data-close="1"></div>' +
    '<div class="model-modal-dialog">' +
      '<button type="button" class="model-modal-close" data-close="1" aria-label="Закрыть">&times;</button>' +
      '<div class="model-modal-body"></div>' +
    '</div>';
  /* Внутрь блока, а не в body: в Тильде весь CSS ограничен областью
     видимости .dk, и окно, висящее в body, осталось бы без стилей —
     карточка вываливалась бы простыней в конец страницы. */
  (document.querySelector('.dk') || document.body).appendChild(MODAL);

  MODAL.addEventListener('click', function (e) {
    var t = e.target;
    if (t.getAttribute && t.getAttribute('data-close')) { e.preventDefault(); closeModel(); return; }

    var sw = t.closest ? t.closest('.color-swatch') : null;
    if (sw) {
      var photo = MODAL.querySelector('.model-modal-photo');
      if (photo) photo.src = sw.getAttribute('data-img');
      var label = MODAL.querySelector('#modal-color');
      if (label) label.textContent = sw.getAttribute('data-name');
      Array.prototype.forEach.call(MODAL.querySelectorAll('.color-swatch'), function (x) {
        x.classList.remove('is-active');
      });
      sw.classList.add('is-active');
      return;
    }

    var cta = t.closest ? t.closest('a[href="#contacts"]') : null;
    if (cta) {
      e.preventDefault();
      /* историю правим сами: history.back() вернул бы прокрутку
         на прежнее место и отменил переход к контактам */
      MODAL_PUSHED = false;
      try { history.replaceState(null, '', location.pathname + location.search); } catch (err) {}
      closeModel(true);
      var c = document.getElementById('contacts');
      if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  return MODAL;
}

function openModel(key, push) {
  if (!MODEL_INDEX[key]) return;
  var el = modalRoot();
  el.querySelector('.model-modal-body').innerHTML = modelDetailHtml(key);
  el.classList.add('is-open');
  el.scrollTop = 0;

  if (MODAL_SCROLL === null) {
    MODAL_SCROLL = [document.documentElement.style.overflow, document.body.style.overflow];
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  }
  if (push) {
    try { history.pushState({ dkModel: key }, '', '#' + key); MODAL_PUSHED = true; } catch (err) {}
  }
  var close = el.querySelector('.model-modal-close');
  if (close) close.focus();
}

function closeModel(fromHistory) {
  if (!MODAL || !MODAL.classList.contains('is-open')) return;
  MODAL.classList.remove('is-open');
  MODAL.querySelector('.model-modal-body').innerHTML = '';
  if (MODAL_SCROLL) {
    document.documentElement.style.overflow = MODAL_SCROLL[0];
    document.body.style.overflow = MODAL_SCROLL[1];
    MODAL_SCROLL = null;
  }
  if (!fromHistory) {
    if (MODAL_PUSHED) { MODAL_PUSHED = false; history.back(); }
    else {
      try { history.replaceState(null, '', location.pathname + location.search); } catch (err) {}
    }
  }
}

function initModelModal() {
  document.addEventListener('click', function (e) {
    var tile = e.target.closest ? e.target.closest('.model-tile') : null;
    if (!tile) return;
    var key = tile.getAttribute('data-key');
    if (!MODEL_INDEX[key]) return;
    e.preventDefault();
    openModel(key, true);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.keyCode === 27) closeModel();
  });

  window.addEventListener('popstate', function () {
    var key = (location.hash || '').replace(/^#/, '');
    MODAL_PUSHED = false;
    if (MODEL_INDEX[key]) openModel(key, false);
    else closeModel(true);
  });

  var start = (location.hash || '').replace(/^#/, '');
  if (MODEL_INDEX[start]) openModel(start, false);
}
