#!/usr/bin/env python3
"""
Сборка сайта «Плёнки и вентиляция Döcke» в код для блока T123 (HTML-код) Тильды.

    python3 tilda/build-t123.py index.html --out tilda/plenki-ventilyaciya-t123.html \
        --scope dk --base https://valerabkrv.github.io/docke-plenki-ventilyaciya/

Отличие от версии для ВЫХЛОПОFF: там CSS и JS лежали инлайном в index.html,
здесь они внешние (assets/style.css, assets/site.js, assets/data.js).
Поэтому:
  * style.css читается с диска, из него убираются комментарии и на каждый
    селектор вешается область видимости .<scope> — иначе CSS Тильды ломает
    вёрстку и наоборот. Комментарии убирать ОБЯЗАТЕЛЬНО до навешивания:
    иначе комментарий прилипает к следующему селектору и правило умирает;
  * data.js и site.js остаются внешними — вместе они ~56 КБ и в лимит
    блока (100 000 байт) вместе с CSS не влезли бы. В <script src> ставится
    абсолютный адрес GitHub Pages;
  * пути к картинкам внутри data.js относительные, а страницу отдаёт Тильда,
    поэтому блок заранее объявляет window.DK_ASSET_BASE — site.js склеивает
    его со всеми относительными путями (функция asset()).
"""
import argparse, re, sys, os

KEEP_AS_IS = ('@keyframes', '@font-face', '@charset', '@import')
BOOT_MARK = '/* ---- ЗАПУСК ---- '


def matching_brace(css, j):
    depth = 0
    for k in range(j, len(css)):
        if css[k] == '{':
            depth += 1
        elif css[k] == '}':
            depth -= 1
            if depth == 0:
                return k
    return len(css) - 1


def scope_css(css, scope):
    def prefix(sel):
        out = []
        for p in (x.strip() for x in sel.split(',')):
            if not p:
                continue
            out.append(p if p in (':root', 'html', 'body') else '.%s %s' % (scope, p))
        return ', '.join(out)

    res, i, n = [], 0, len(css)
    while i < n:
        j = css.find('{', i)
        if j == -1:
            res.append(css[i:])
            break
        head = css[i:j].strip()
        if head.startswith('@media') or head.startswith('@supports'):
            k = matching_brace(css, j)
            res.append('\n' + head + '{' + scope_css(css[j + 1:k], scope) + '}')
            i = k + 1
        elif head.startswith(KEEP_AS_IS):
            k = matching_brace(css, j)
            res.append('\n' + css[i:k + 1].strip())
            i = k + 1
        else:
            k = css.find('}', j)
            res.append('\n' + prefix(head) + '{' + css[j + 1:k].strip() + '}')
            i = k + 1
    return ''.join(res)


def build(src_path, scope, base):
    root = os.path.dirname(os.path.abspath(src_path)) or '.'
    src = open(src_path, encoding='utf-8').read()

    body = re.search(r'<body[^>]*>(.*?)</body>', src, re.S)
    if not body:
        sys.exit('Не нашёл <body> в ' + src_path)
    body = body.group(1)

    css_href = re.search(r'<link rel="stylesheet" href="([^"?]+)', src)
    if not css_href:
        sys.exit('Не нашёл <link rel="stylesheet"> в ' + src_path)
    css = open(os.path.join(root, css_href.group(1)), encoding='utf-8').read()
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)         # обязательно до scope_css
    css = scope_css(css, scope)

    fonts = re.search(r'(<link rel="preconnect".*?rel="stylesheet">)', src, re.S)
    fonts = fonts.group(1) if fonts else ''

    # 1) внешние скрипты. Просто переписать их на абсолютные адреса нельзя:
    #    Тильда вставляет код блока так, что теги <script src> не выполняются
    #    (проверено на живой странице — data.js и site.js висели в DOM, но
    #    ни FILMS, ни renderSection не появлялись). Поэтому теги вырезаем,
    #    а файлы блок подгружает сам и запускает рендер в колбэке.
    srcs = re.findall(r'<script src="assets/([^"]+)"></script>', body)
    body = re.sub(r'<script src="assets/[^"]+"></script>\s*', '', body)

    # 2) картинки в разметке
    body = body.replace('src="assets/', 'src="' + base + 'assets/')

    # 3) хвост инлайнового скрипта (после маркера ЗАПУСК) уезжает в колбэк
    i = body.find(BOOT_MARK)
    if i == -1:
        sys.exit('Не нашёл маркер «%s» в %s' % (BOOT_MARK, src_path))
    j = body.find('</script>', i)
    boot = body[body.find('*/', i) + 2:j].strip()
    chain = 'start();'
    for name in reversed(srcs):
        chain = 'load("%sassets/%s", function(){ %s });' % (base, name, chain)
    loader = (
        '\n\n/* Тильда не выполняет <script src> внутри блока — грузим сами,\n'
        '   строго по очереди: site.js рассчитывает на готовый data.js. */\n'
        'function load(src, next) {\n'
        '  var s = document.createElement("script");\n'
        '  s.src = src;\n'
        '  s.onload = next;\n'
        '  s.onerror = function () { console.error("Döcke: не загрузился " + src); };\n'
        '  document.head.appendChild(s);\n'
        '}\n'
        'function start() {\n'
        '%s\n'
        '}\n'
        '%s\n'
    ) % ('\n'.join('  ' + l for l in boot.splitlines()), chain)
    body = body[:i] + loader + body[j:]

    note = ('<!-- Плёнки, мембраны и кровельная вентиляция Döcke — блок T123 для Тильды.\n'
            '     Собрано из index.html скриптом tilda/build-t123.py, руками не править:\n'
            '     правки делаются в исходнике и пересобираются.\n'
            '     Картинки, data.js и site.js: %s\n'
            '     Цены правятся прямо здесь — блок DK_PRICES в самом низу. -->\n' % base)

    boot = ('<script>window.DK_ASSET_BASE = "%s";</script>\n' % base)

    return (note + fonts + '\n<style>' + css + '\n</style>\n' +
            '<div class="%s">\n' % scope + boot + body.strip() + '\n</div>\n')


def check(out, scope, base):
    problems = []
    css = re.search(r'<style>(.*?)</style>', out, re.S).group(1)
    if '/*' in css:
        problems.append('в CSS остались комментарии')
    for sel in re.findall(r'(?m)^([^@{\n][^{\n]*)\{', css):
        s = sel.strip()
        if not (s.startswith('.' + scope) or s in (':root', 'html', 'body')
                or s.startswith(('body,', 'html,', ':root,'))):
            problems.append('селектор без области видимости: ' + s[:60])
    if 'src="assets/' in out:
        problems.append('остались относительные пути src="assets/')
    if '<script src=' in out:
        problems.append('остался тег <script src> — в блоке Тильды он не выполнится')
    for need in ('function load(', 'function start(', 'renderSection'):
        if need not in out:
            problems.append('в блоке нет ' + need)
    if base not in out:
        problems.append('не подставился базовый адрес')
    return problems


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('--out', required=True)
    ap.add_argument('--scope', default='dk')
    ap.add_argument('--base', required=True, help='адрес GitHub Pages со слэшем на конце')
    a = ap.parse_args()

    out = build(a.src, a.scope, a.base)
    open(a.out, 'w', encoding='utf-8').write(out)

    size = len(out.encode('utf-8'))
    print('%s — %d байт (лимит T123 = 100 000, запас %d)' % (a.out, size, 100000 - size))
    if size > 100000:
        print('!! НЕ ВЛЕЗЕТ в блок T123 — разбивать на два.')
    problems = check(out, a.scope, a.base)
    for p in problems:
        print('!!', p)
    if not problems:
        print('проверки пройдены')


if __name__ == '__main__':
    main()
