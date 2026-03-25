import * as path from 'node:path';
import Mocha from 'mocha';

export function run(): Promise<void> {
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
  });

  const testsRoot = __dirname;
  const files = [
    'tokenParsing.test.js',
    'usageMapper.test.js',
    'usageService.test.js',
    'statusBar.test.js',
    'tooltip.test.js',
    'extension.test.js',
  ];

  for (const file of files) {
    mocha.addFile(path.resolve(testsRoot, file));
  }

  return new Promise((resolve, reject) => {
    mocha.run((failures) => {
      if (failures > 0) {
        reject(new Error(`${failures} test(s) failed.`));
        return;
      }

      resolve();
    });
  });
}

