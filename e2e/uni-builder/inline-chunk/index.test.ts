import path from 'path';
import { expect, test } from '@playwright/test';
import { build, getHrefByEntryName } from '@scripts/shared';
import { BundlerChain } from '@rsbuild/shared';

const RUNTIME_CHUNK_NAME = 'bundler-runtime';

// Rspack will not output bundler-runtime source map, but it not necessary
// Identify whether the bundler-runtime chunk is included through some specific code snippets
const isRuntimeChunkInHtml = (html: string): boolean =>
  Boolean(html.includes('bundler-runtime') && html.includes('Loading chunk'));

// use source-map for easy to test. By default, Rsbuild use hidden-source-map
const toolsConfig = {
  bundlerChain: (chain: BundlerChain) => {
    chain.devtool('source-map');
  },
  htmlPlugin: (config: any) => {
    // minify will remove sourcemap comment
    if (typeof config.minify === 'object') {
      config.minify.minifyJS = false;
      config.minify.minifyCSS = false;
    }
  },
};

// TODO: uni-builder
test.skip('disableInlineRuntimeChunk', () => {
  let rsbuild: Awaited<ReturnType<typeof build>>;
  let files: Record<string, string>;

  test.beforeAll(async () => {
    rsbuild = await build({
      cwd: __dirname,
      runServer: true,
      rsbuildConfig: {
        tools: toolsConfig,
        output: {
          // disableInlineRuntimeChunk: true,
        },
      },
    });

    files = await rsbuild.unwrapOutputJSON(false);
  });

  test.afterAll(async () => {
    await rsbuild.close();
  });

  test('should emit bundler-runtime', async ({ page }) => {
    // test runtime
    await page.goto(getHrefByEntryName('index', rsbuild.port));

    expect(await page.evaluate(`window.test`)).toBe('aaaa');

    // bundler-runtime file in output
    expect(
      Object.keys(files).some(
        (fileName) =>
          fileName.includes(RUNTIME_CHUNK_NAME) && fileName.endsWith('.js'),
      ),
    ).toBe(true);
  });
});

// TODO: uni-builder
test.skip('inline runtime chunk by default', async ({ page }) => {
  const rsbuild = await build({
    cwd: __dirname,
    runServer: true,
    rsbuildConfig: {
      tools: toolsConfig,
    },
  });

  // test runtime
  await page.goto(getHrefByEntryName('index', rsbuild.port));

  expect(await page.evaluate(`window.test`)).toBe('aaaa');

  const files = await rsbuild.unwrapOutputJSON(false);

  // no bundler-runtime file in output
  expect(
    Object.keys(files).some(
      (fileName) =>
        fileName.includes(RUNTIME_CHUNK_NAME) && fileName.endsWith('.js'),
    ),
  ).toBe(false);

  // found bundler-runtime file in html
  const indexHtml = files[path.resolve(__dirname, './dist/index.html')];

  expect(isRuntimeChunkInHtml(indexHtml)).toBeTruthy();

  await rsbuild.close();
});

// TODO: uni-builder
test.skip('inline runtime chunk and remove source map when devtool is "hidden-source-map"', async () => {
  const rsbuild = await build({
    cwd: __dirname,
    rsbuildConfig: {
      tools: {
        bundlerChain(chain) {
          chain.devtool('hidden-source-map');
        },
      },
    },
  });

  const files = await rsbuild.unwrapOutputJSON(false);

  // should not emit source map of bundler-runtime
  expect(
    Object.keys(files).some(
      (fileName) =>
        fileName.includes(RUNTIME_CHUNK_NAME) && fileName.endsWith('.js.map'),
    ),
  ).toBe(false);
});

// TODO: uni-builder
test.skip('inline runtime chunk by default with multiple entries', async () => {
  const rsbuild = await build({
    cwd: __dirname,
    rsbuildConfig: {
      source: {
        entry: {
          index: path.resolve(__dirname, './src/index.js'),
          another: path.resolve(__dirname, './src/another.js'),
        },
      },
      tools: toolsConfig,
    },
  });
  const files = await rsbuild.unwrapOutputJSON(false);

  // no bundler-runtime file in output
  expect(
    Object.keys(files).some(
      (fileName) =>
        fileName.includes(RUNTIME_CHUNK_NAME) && fileName.endsWith('.js'),
    ),
  ).toBe(false);

  // found bundler-runtime file in html
  const indexHtml = files[path.resolve(__dirname, './dist/index.html')];
  const anotherHtml = files[path.resolve(__dirname, './dist/another.html')];

  expect(isRuntimeChunkInHtml(indexHtml)).toBeTruthy();
  expect(isRuntimeChunkInHtml(anotherHtml)).toBeTruthy();
});