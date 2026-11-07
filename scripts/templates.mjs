import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Both View Source and the editable runtime entries use these authored files.
export async function composeTemplate(filename, { appName = '' } = {}) {
  let source = await readFile(filename, 'utf8');
  const includes = [...source.matchAll(/\{\{include:([^}]+)\}\}/g)];
  for (const [token, relative] of includes) {
    source = source.replace(
      token,
      await composeTemplate(path.resolve(path.dirname(filename), relative), {
        appName
      })
    );
  }
  const views = [...source.matchAll(/\{\{view:([^:}]+):([^}]+)\}\}/g)];
  for (const [token, name, relative] of views) {
    const content = await composeTemplate(
      path.resolve(path.dirname(filename), relative),
      { appName }
    );
    source = source.replace(
      token,
      '<div style="display:contents" data-feature="' +
        name +
        '" data-simply-field="layout"><template id="' +
        name +
        '">' +
        content +
        '</template></div>'
    );
  }
  if (appName) {
    source = source.replaceAll(
      '{{title}}',
      appName[0].toUpperCase() + appName.slice(1)
    );
  }
  if (source.includes('{{profile}}')) {
    source = source.replace(
      '{{profile}}',
      await composeTemplate(
        new URL('../packages/solid-profile/src/profile.html', import.meta.url)
          .pathname,
        { appName }
      )
    );
  }
  if (source.includes('{{appPreferences}}')) {
    const preferences =
      appName && appName !== 'profile'
        ? await readFile(
            new URL(`../apps/${appName}/src/preferences.html`, import.meta.url),
            'utf8'
          )
        : '';
    source = source.replace('{{appPreferences}}', preferences);
  }
  return source;
}

// Template compilation is explicit; ordinary text imports always return bytes
// decoded as UTF-8 without composition or markup changes.
export async function templateText(filename) {
  const appName = /\/apps\/([^/]+)\//.exec(filename)?.[1] || '';
  return (
    '<div style="display:contents">' +
    (await composeTemplate(filename, { appName })) +
    '</div>'
  );
}

const textPrefix = '\0solid-apps-text:';

export function editableSources() {
  return {
    name: 'solid-apps-editable-sources',
    transform(code, id) {
      if (!code.includes('with') || !code.includes('text')) {
        return;
      }
      const ast = this.parse(code);
      let changed = false;
      for (const node of ast.body) {
        if (
          node.type === 'ImportDeclaration' &&
          node.attributes?.some(
            (attribute) =>
              attribute.key.name === 'type' && attribute.value.value === 'text'
          )
        ) {
          // Rollup keys imports by specifier before attribute-aware resolution.
          // Give text its own internal identity, even when the same module is
          // also imported as executable code. Authored code/maps stay intact.
          node.source.value =
            textPrefix + path.resolve(path.dirname(id), node.source.value);
          changed = true;
        }
      }
      if (changed) {
        return { code, ast, map: null };
      }
    },
    async load(id) {
      if (id.endsWith('?entries')) {
        const filename = id.slice(0, -8);
        const source = await readFile(filename, 'utf8');
        this.addWatchFile(filename);
        const tree = this.parse(source);
        const imports = new Map(
          tree.body
            .filter((node) => node.type === 'ImportDeclaration')
            .flatMap((node) =>
              node.specifiers.map((spec) => [
                spec.local.name,
                {
                  filename: node.source.value,
                  text: node.attributes?.some(
                    (attribute) =>
                      attribute.key.name === 'type' &&
                      attribute.value.value === 'text'
                  )
                }
              ])
            )
        );
        const entries = {};
        const metadataImports = [];
        const metadataExports = [];
        for (const statement of tree.body) {
          if (statement.type !== 'ExportNamedDeclaration') {
            continue;
          }
          if (statement.source) {
            const name = 'componentSources' + metadataImports.length;
            const target =
              path.resolve(path.dirname(filename), statement.source.value) +
              '?entries';
            metadataImports.push(
              'import ' + name + ' from ' + JSON.stringify(target) + ';'
            );
            for (const specifier of statement.specifiers) {
              metadataExports.push(
                JSON.stringify(specifier.exported.name) +
                  ': ' +
                  name +
                  '[' +
                  JSON.stringify(specifier.local.name) +
                  ']'
              );
            }
            continue;
          }
          for (const declaration of statement.declaration?.declarations || []) {
            if (declaration.init?.type !== 'ObjectExpression') {
              continue;
            }
            const sections = {};
            for (const section of declaration.init.properties) {
              if (section.value?.type !== 'ObjectExpression') {
                continue;
              }
              const functions = {};
              for (const entry of section.value.properties) {
                const imported = imports.get(entry.value?.name);
                if (imported?.text) {
                  functions[entry.key.name || entry.key.value] = {
                    origin: path.relative(
                      process.cwd(),
                      path.resolve(
                        path.dirname(filename),
                        imported.filename.replace(/\?template$/, '')
                      )
                    )
                  };
                  continue;
                }
                if (
                  !['FunctionExpression', 'ArrowFunctionExpression'].includes(
                    entry.value?.type
                  )
                ) {
                  continue;
                }
                let text = source.slice(entry.value.start, entry.value.end);
                if (entry.method) {
                  text = source
                    .slice(entry.start, entry.end)
                    .replace(
                      /^(async\s+)?([A-Za-z_$][\w$]*)\s*\(/,
                      '$1function $2('
                    );
                }
                functions[entry.key.name || entry.key.value] = {
                  source: text,
                  origin: path.relative(process.cwd(), filename),
                  line: source.slice(0, entry.start).split('\n').length
                };
              }
              if (Object.keys(functions).length) {
                sections[section.key.name || section.key.value] = functions;
              }
            }
            entries[declaration.id.name] = sections;
          }
        }
        return (
          metadataImports.join('\n') +
          '\nexport default { ...' +
          JSON.stringify(entries) +
          (metadataExports.length ? ', ' + metadataExports.join(', ') : '') +
          ' };'
        );
      }
      if (!id.startsWith(textPrefix)) {
        return;
      }
      const target = id.slice(textPrefix.length);
      const compiled = target.endsWith('?template');
      const filename = compiled ? target.slice(0, -9) : target;
      this.addWatchFile(filename);
      const source = compiled
        ? await templateText(filename)
        : await readFile(filename, 'utf8');
      return 'export default ' + JSON.stringify(source) + ';';
    },
    resolveId(id, importer, options) {
      if (options.attributes.type === 'text') {
        const filename = id.startsWith(textPrefix)
          ? id.slice(textPrefix.length)
          : path.isAbsolute(id)
            ? id
            : path.resolve(path.dirname(importer), id);
        return { id: textPrefix + filename, attributes: {} };
      }
      if (id.endsWith('?entries')) {
        if (path.isAbsolute(id)) {
          return id;
        }
        if (id.startsWith('.')) {
          return path.resolve(path.dirname(importer), id);
        }
      }
    }
  };
}
