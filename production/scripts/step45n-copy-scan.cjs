const fs = require('fs');
const path = require('path');
const ts = require(path.resolve(__dirname, '..', 'apps', 'web-portal', 'node_modules', 'typescript'));

const root = path.resolve(__dirname, '..');
const pagesDir = path.join(root, 'apps', 'web-portal', 'src', 'pages');
const excluded = new Set(['InternalDesignSystemPage.tsx']);
const propNames = new Set(['title','description','label','placeholder','aria-label','ariaLabel','eyebrow','emptyContent','primaryHeader']);
const objectTextProps = new Set(['label','header','title','description','message','emptyContent','primaryHeader']);
const records = new Map();

function componentName(node) {
  let current = node.parent;
  while (current) {
    if (ts.isFunctionDeclaration(current) && current.name && /^[A-Z]/.test(current.name.text)) {
      return current.name.text;
    }
    if ((ts.isArrowFunction(current) || ts.isFunctionExpression(current))
      && current.parent && ts.isVariableDeclaration(current.parent)
      && ts.isIdentifier(current.parent.name)
      && /^[A-Z]/.test(current.parent.name.text)) {
      return current.parent.name.text;
    }
    current = current.parent;
  }
  return null;
}

function add(text, file, kind, node, sf) {
  text = text.replace(/\s+/g, ' ').trim();
  if (!/[A-Za-z]/.test(text)) return;
  if (text === 'INNO.One' || text === 'I1') return;
  const key = text;
  if (!records.has(key)) records.set(key, []);
  records.get(key).push({
    file,
    kind,
    pos: node.getStart(sf),
    end: node.getEnd(),
    component: componentName(node),
  });
}

for (const file of fs.readdirSync(pagesDir).filter(x => x.endsWith('.tsx')).sort()) {
  if (excluded.has(file)) continue;
  const full = path.join(pagesDir, file);
  const source = fs.readFileSync(full, 'utf8');
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  function collectStrings(expr, kind) {
    if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
      add(expr.text, file, kind, expr, sf);
      return;
    }
    if (ts.isConditionalExpression(expr)) {
      collectStrings(expr.whenTrue, kind);
      collectStrings(expr.whenFalse, kind);
      return;
    }
    if (ts.isBinaryExpression(expr)) {
      const op = expr.operatorToken.kind;
      if (
        op === ts.SyntaxKind.PlusToken
        || op === ts.SyntaxKind.QuestionQuestionToken
        || op === ts.SyntaxKind.BarBarToken
        || op === ts.SyntaxKind.AmpersandAmpersandToken
      ) {
        collectStrings(expr.left, kind);
        collectStrings(expr.right, kind);
      }
      return;
    }
    if (ts.isTemplateExpression(expr)) {
      add(expr.head.text, file, kind + ':template', expr.head, sf);
      for (const span of expr.templateSpans) {
        add(span.literal.text, file, kind + ':template', span.literal, sf);
      }
      return;
    }
    if (
      ts.isParenthesizedExpression(expr)
      || ts.isAsExpression(expr)
      || ts.isNonNullExpression(expr)
      || ts.isTypeAssertionExpression(expr)
    ) {
      collectStrings(expr.expression, kind);
      return;
    }
    // Nested JSX is visited independently by the main walker.
  }

  function visit(node) {
    if (ts.isJsxText(node)) {
      add(node.getText(sf), file, 'jsxText', node, sf);
    }
    if (ts.isJsxAttribute(node) && propNames.has(node.name.getText(sf)) && node.initializer) {
      if (ts.isStringLiteral(node.initializer)) {
        add(node.initializer.text, file, 'jsxProp', node.initializer, sf);
      } else if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
        collectStrings(node.initializer.expression, 'jsxPropExpr');
      }
    }
    if (ts.isJsxExpression(node)
      && node.parent
      && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))
      && node.expression) {
      collectStrings(node.expression, 'jsxChildExpr');
    }

    if (ts.isPropertyAssignment(node)) {
      const name = node.name.getText(sf).replace(/^['"]|['"]$/g, '');
      if (objectTextProps.has(name)) {
        const parent = node.parent;
        const hasAuthoritativeKey = ts.isObjectLiteralExpression(parent)
          && parent.properties.some((p) => ts.isPropertyAssignment(p)
            && ['labelKey','descriptionKey'].includes(p.name.getText(sf).replace(/^['"]|['"]$/g, '')));
        if (!hasAuthoritativeKey) {
          if (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer)) {
            add(node.initializer.text, file, 'object:' + name, node.initializer, sf);
          } else {
            collectStrings(node.initializer, 'object:' + name);
          }
        }
      }
    }

    if (ts.isNewExpression(node)
      && node.expression.getText(sf) === 'Error'
      && node.arguments?.[0]
      && (ts.isStringLiteral(node.arguments[0]) || ts.isNoSubstitutionTemplateLiteral(node.arguments[0]))) {
      add(node.arguments[0].text, file, 'errorMessage', node.arguments[0], sf);
    }

    if (ts.isCallExpression(node)
      && ts.isIdentifier(node.expression)
      && ['setValidationError'].includes(node.expression.text)
      && node.arguments[0]
      && (ts.isStringLiteral(node.arguments[0]) || ts.isNoSubstitutionTemplateLiteral(node.arguments[0]))) {
      add(node.arguments[0].text, file, 'validationMessage', node.arguments[0], sf);
    }

    if (ts.isArrayLiteralExpression(node)
      && node.elements.length === 2
      && ts.isStringLiteral(node.elements[0])
      && ts.isStringLiteral(node.elements[1])
      && /^[a-z0-9_]+$/.test(node.elements[0].text)
      && /^[A-Z]/.test(node.elements[1].text)) {
      add(node.elements[1].text, file, 'tupleLabel', node.elements[1], sf);
    }

    ts.forEachChild(node, visit);
  }
  visit(sf);
}

const items = [...records.entries()]
  .map(([text, contexts]) => ({ text, contexts }))
  .sort((a,b) => a.text.localeCompare(b.text));
const out = {
  unique: items.length,
  occurrences: items.reduce((n,x)=>n+x.contexts.length,0),
  missingComponent: items.reduce((n,x)=>n+x.contexts.filter(c=>!c.component).length,0),
  items,
};
fs.writeFileSync('C:\\Temp\\step45n-copy.json', JSON.stringify(out, null, 2));
console.log('unique=' + out.unique);
console.log('occurrences=' + out.occurrences);
console.log('missingComponent=' + out.missingComponent);
const byFile = {};
for (const item of items) for (const c of item.contexts) byFile[c.file] = (byFile[c.file]||0)+1;
console.log(JSON.stringify(byFile, null, 2));
