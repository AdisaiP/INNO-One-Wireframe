const fs = require('fs');
const path = require('path');
const ts = require(path.resolve(__dirname, '..', 'apps', 'web-portal', 'node_modules', 'typescript'));

const root = path.resolve(__dirname, '..');
const pagesDir = path.join(root, 'apps', 'web-portal', 'src', 'pages');
const localesDir = path.join(root, 'packages', 'i18n', 'src', 'locales');
const translationDir = path.join(__dirname, 'step45n-translations');
const translationMap = {};
if (fs.existsSync(translationDir)) {
  for (const file of fs.readdirSync(translationDir).filter(x => x.endsWith('.json')).sort()) {
    Object.assign(translationMap, JSON.parse(fs.readFileSync(path.join(translationDir, file), 'utf8')));
  }
}

const domainForPage = (file) => {
  if (/^Admin/.test(file)) return 'admin';
  if (/^(Asset|Assets|Contract|Contracts)/.test(file)) return 'assets';
  if (/^(Device|Devices|Discovery|Inventory|Software|AgentDeployment)/.test(file)) return 'devices';
  if (/^(Helpdesk|Ticket|Tickets|BusinessCalendar)/.test(file)) return 'helpdesk';
  if (/^Report/.test(file)) return 'reports';
  return 'common';
};

const enFiles = fs.readdirSync(path.join(localesDir, 'en-US')).filter(x => x.endsWith('.json'));
const reverse = new Map();
const catalogs = {};
for (const locale of ['en-US', 'th-TH']) {
  catalogs[locale] = {};
  for (const file of enFiles) {
    const p = path.join(localesDir, locale, file);
    catalogs[locale][path.basename(file, '.json')] = JSON.parse(fs.readFileSync(p, 'utf8'));
  }
}
for (const file of enFiles) {
  const domain = path.basename(file, '.json');
  for (const [key, value] of Object.entries(catalogs['en-US'][domain])) {
    if (!reverse.has(value)) reverse.set(value, []);
    reverse.get(value).push(key);
  }
}

function slug(value) {
  const words = value
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8);
  if (!words.length) return 'copy';
  const [first, ...rest] = words;
  return (first.toLowerCase() + rest.map(x => x[0].toUpperCase() + x.slice(1).toLowerCase()).join(''))
    .replace(/^[0-9]/, 'n$&');
}
function pageStem(file) {
  return file.replace(/Page\.tsx$/, '').replace(/\.tsx$/, '')
    .replace(/^[A-Z]/, x => x.toLowerCase());
}
function uniqueKey(domain, file, text) {
  let base = domain + '.step45n.' + pageStem(file) + '.' + slug(text);
  let key = base;
  let i = 2;
  const allKeys = new Set(Object.values(catalogs['en-US']).flatMap(x => Object.keys(x)));
  while (allKeys.has(key)) key = base + i++;
  return key;
}
function lookup(file, text) {
  const hits = reverse.get(text);
  if (hits && hits.length) {
    return hits.slice().sort((a,b) => a.length - b.length || a.localeCompare(b))[0];
  }
  const th = translationMap[text];
  if (!th) return null;
  const domain = domainForPage(file);
  const key = uniqueKey(domain, file, text);
  catalogs['en-US'][domain][key] = text;
  catalogs['th-TH'][domain][key] = th;
  reverse.set(text, [key]);
  return key;
}
function componentInfo(node) {
  let current = node.parent;
  while (current) {
    if (ts.isFunctionDeclaration(current) && current.name && /^[A-Z]/.test(current.name.text) && current.body) {
      return { name: current.name.text, body: current.body };
    }
    if ((ts.isArrowFunction(current) || ts.isFunctionExpression(current))
      && current.parent && ts.isVariableDeclaration(current.parent)
      && ts.isIdentifier(current.parent.name) && /^[A-Z]/.test(current.parent.name.text)
      && ts.isBlock(current.body)) {
      return { name: current.parent.name.text, body: current.body };
    }
    current = current.parent;
  }
  return null;
}
function applyEdits(source, edits) {
  edits.sort((a,b) => b.pos - a.pos || b.end - a.end);
  for (const e of edits) source = source.slice(0, e.pos) + e.text + source.slice(e.end);
  return source;
}

let replacements = 0;
let filesChanged = 0;
const untranslated = new Set();

for (const file of fs.readdirSync(pagesDir).filter(x => x.endsWith('.tsx')).sort()) {
  if (file === 'InternalDesignSystemPage.tsx') continue;
  const full = path.join(pagesDir, file);
  const source = fs.readFileSync(full, 'utf8');
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  const hookBodies = new Map();

  function register(node, text, replacement, kind) {
    const info = componentInfo(node);
    if (!info) return;
    edits.push({ pos: node.getStart(sf), end: node.getEnd(), text: replacement });
    hookBodies.set(info.body.getStart(sf) + 1, info.name);
    replacements++;
  }

  function mapLiteral(node, kind) {
    const raw = node.text;
    if (!/[A-Za-z]/.test(raw)) return;
    const text = raw.trim();
    const key = lookup(file, text);
    if (!key) { untranslated.add(text); return; }
    let replacement = "t45n('" + key.replace(/'/g, "\\'") + "')";
    if (/^\s/.test(raw)) replacement = "' ' + " + replacement;
    if (/\s$/.test(raw)) replacement = replacement + " + ' '";
    register(node, text, replacement, kind);
  }

  function walkExpr(expr) {
    if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
      mapLiteral(expr, 'expr');
      return;
    }
    if (ts.isConditionalExpression(expr)) {
      walkExpr(expr.whenTrue); walkExpr(expr.whenFalse); return;
    }
    if (ts.isBinaryExpression(expr)) {
      const op = expr.operatorToken.kind;
      if ([
        ts.SyntaxKind.PlusToken,
        ts.SyntaxKind.QuestionQuestionToken,
        ts.SyntaxKind.BarBarToken,
        ts.SyntaxKind.AmpersandAmpersandToken,
      ].includes(op)) {
        walkExpr(expr.left);
        walkExpr(expr.right);
      }
      return;
    }
    if (ts.isParenthesizedExpression(expr) || ts.isAsExpression(expr) || ts.isNonNullExpression(expr) || ts.isTypeAssertionExpression(expr)) {
      walkExpr(expr.expression);
    }
  }

  function visit(node) {
    if (ts.isJsxText(node)) {
      const raw = node.getText(sf);
      const value = raw.replace(/\s+/g, ' ').trim();
      if (value && /[A-Za-z]/.test(value)) {
        const key = lookup(file, value);
        if (key) {
          const leading = /^\s/.test(raw) ? "{' '}" : "";
          const trailing = /\s$/.test(raw) ? "{' '}" : "";
          register(node, value, leading + "{t45n('" + key.replace(/'/g, "\\'") + "')}" + trailing, 'jsxText');
        } else {
          untranslated.add(value);
        }
      }
    }
    if (ts.isJsxAttribute(node) && node.initializer) {
      const prop = node.name.getText(sf);
      if (['title','description','label','placeholder','aria-label','ariaLabel','eyebrow','emptyContent','primaryHeader'].includes(prop)) {
        if (ts.isStringLiteral(node.initializer)) {
          const value = node.initializer.text.trim();
          if (/[A-Za-z]/.test(value)) {
            const key = lookup(file, value);
            if (key) register(node.initializer, value, "{t45n('" + key.replace(/'/g, "\\'") + "')}", 'prop');
            else untranslated.add(value);
          }
        } else if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
          walkExpr(node.initializer.expression);
        }
      }
    }
    if (ts.isJsxExpression(node) && node.parent && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent)) && node.expression) {
      walkExpr(node.expression);
    }
    if (ts.isPropertyAssignment(node)) {
      const name = node.name.getText(sf).replace(/^['"]|['"]$/g, '');
      if (['label','header','title','description','message','emptyContent','primaryHeader'].includes(name)) {
        const parent = node.parent;
        const hasAuthoritativeKey = ts.isObjectLiteralExpression(parent)
          && parent.properties.some((p) => ts.isPropertyAssignment(p)
            && ['labelKey','descriptionKey'].includes(p.name.getText(sf).replace(/^['"]|['"]$/g, '')));
        if (!hasAuthoritativeKey && (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer))) {
          mapLiteral(node.initializer, 'object:' + name);
        }
      }
    }

    if (ts.isNewExpression(node)
      && node.expression.getText(sf) === 'Error'
      && node.arguments?.[0]
      && (ts.isStringLiteral(node.arguments[0]) || ts.isNoSubstitutionTemplateLiteral(node.arguments[0]))) {
      mapLiteral(node.arguments[0], 'errorMessage');
    }

    if (ts.isCallExpression(node)
      && ts.isIdentifier(node.expression)
      && node.expression.text === 'setValidationError'
      && node.arguments[0]
      && (ts.isStringLiteral(node.arguments[0]) || ts.isNoSubstitutionTemplateLiteral(node.arguments[0]))) {
      mapLiteral(node.arguments[0], 'validationMessage');
    }

    if (ts.isArrayLiteralExpression(node)
      && node.elements.length === 2
      && ts.isStringLiteral(node.elements[0])
      && ts.isStringLiteral(node.elements[1])
      && /^[a-z0-9_]+$/.test(node.elements[0].text)
      && /^[A-Z]/.test(node.elements[1].text)) {
      mapLiteral(node.elements[1], 'tupleLabel');
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);

  if (!edits.length) continue;

  const bodyStarts = [...hookBodies.keys()];
  for (const pos of bodyStarts) {
    const body = [...hookBodies.entries()].find(([p]) => p === pos);
    const bodyNodeTextStart = pos;
    const window = source.slice(pos, Math.min(source.length, pos + 260));
    if (!window.includes('t45n') && !window.includes('useStep45NI18n')) {
      edits.push({ pos, end: pos, text: "\n  const { t: t45n } = useStep45NI18n();" });
    }
  }

  if (!source.includes('useStep45NI18n')) {
    let importEnd = 0;
    for (const st of sf.statements) if (ts.isImportDeclaration(st)) importEnd = st.end;
    edits.push({
      pos: importEnd,
      end: importEnd,
      text: "\nimport { useI18n as useStep45NI18n } from '@inno/i18n';",
    });
  }

  const next = applyEdits(source, edits);
  fs.writeFileSync(full, next);
  filesChanged++;
}

for (const locale of ['en-US','th-TH']) {
  for (const [domain, obj] of Object.entries(catalogs[locale])) {
    const p = path.join(localesDir, locale, domain + '.json');
    fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
  }
}

console.log('filesChanged=' + filesChanged);
console.log('replacements=' + replacements);
console.log('untranslatedUnique=' + untranslated.size);
fs.writeFileSync('C:\\Temp\\step45n-untranslated.txt', [...untranslated].sort().map((x,i)=>String(i+1).padStart(4,'0')+'\t'+x).join('\n'));
