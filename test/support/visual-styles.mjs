import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Optional review artifacts from the existing real-workflow screenshots.
// Comparing these across a refactor catches cascade/layout changes without
// asserting copies of individual CSS declarations in the regression suite.
export async function recordVisualStyles(page, name, screenshot) {
  const directory = process.env.SWB_VISUAL_DIR;
  if (!directory) {
    return;
  }
  const result = await page.evaluate(() => {
    const properties = [
      'display',
      'position',
      'visibility',
      'width',
      'height',
      'min-width',
      'min-height',
      'max-width',
      'max-height',
      'padding-top',
      'padding-right',
      'padding-bottom',
      'padding-left',
      'margin-top',
      'margin-right',
      'margin-bottom',
      'margin-left',
      'color',
      'background-color',
      'font-family',
      'font-size',
      'font-weight',
      'line-height',
      'border-top-width',
      'border-top-color',
      'border-radius',
      'overflow-x',
      'overflow-y',
      'gap',
      'grid-template-columns',
      'flex',
      'align-items',
      'justify-content',
      'white-space',
      'text-align',
      'text-decoration-line',
      'z-index'
    ];
    function collect(context) {
      return [...context.querySelectorAll('body *')]
        .filter(
          (element) =>
            !['STYLE', 'SCRIPT', 'TEMPLATE'].includes(element.tagName) &&
            element.getClientRects().length
        )
        .map((element) => {
          const style = context.defaultView.getComputedStyle(element);
          return {
            tag: element.tagName,
            classes: element.getAttribute('class') || '',
            command: element.getAttribute('data-simply-command') || '',
            styles: Object.fromEntries(
              properties.map((property) => [
                property,
                style.getPropertyValue(property)
              ])
            )
          };
        });
    }
    const frames = [];
    for (const frame of document.querySelectorAll('iframe')) {
      try {
        if (frame.contentDocument?.body) {
          frames.push(collect(frame.contentDocument));
        }
      }
      catch {
        /* Cross-origin providers remain outside this review probe. */
      }
    }
    return {
      width: innerWidth,
      height: innerHeight,
      nodes: collect(document),
      frames
    };
  });
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, name + '.json'),
    JSON.stringify(result, null, 2)
  );
  await writeFile(
    path.join(directory, name + '.png'),
    Buffer.from(screenshot, 'base64')
  );
}
