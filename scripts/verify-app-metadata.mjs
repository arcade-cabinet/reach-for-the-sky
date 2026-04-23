import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { waitFor, withDevPage } from './browser-smoke-harness.mjs';

const expectedScreenshots = new Map([
  ['assets/previews/menu-desktop.png', { width: 1440, height: 900, formFactor: 'wide' }],
  ['assets/previews/opening-desktop.png', { width: 1440, height: 900, formFactor: 'wide' }],
  ['assets/previews/skyline-victory-desktop.png', { width: 1440, height: 900, formFactor: 'wide' }],
  ['assets/previews/daily-report-desktop.png', { width: 1440, height: 900, formFactor: 'wide' }],
  ['assets/previews/privacy-lens-desktop.png', { width: 1280, height: 820, formFactor: 'wide' }],
  ['assets/previews/weather-stress-desktop.png', { width: 1440, height: 900, formFactor: 'wide' }],
  [
    'assets/previews/recovery-contract-desktop.png',
    { width: 1440, height: 900, formFactor: 'wide' },
  ],
  ['assets/previews/opening-mobile.png', { width: 390, height: 844, formFactor: 'narrow' }],
]);

const requiredIcons = new Set([
  'assets/icons/reach-icon.svg',
  'assets/icons/reach-icon-192.png',
  'assets/icons/reach-icon-512.png',
  'assets/icons/reach-maskable-512.png',
]);

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

async function verifyAndroidLauncherResources() {
  const foreground = await readFile(
    resolve('android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml'),
    'utf8',
  );
  const background = await readFile(
    resolve('android/app/src/main/res/drawable/ic_launcher_background.xml'),
    'utf8',
  );
  const backgroundColor = await readFile(
    resolve('android/app/src/main/res/values/ic_launcher_background.xml'),
    'utf8',
  );

  assert(foreground.includes('M49,10h10'), 'Android launcher foreground is not the tower icon');
  assert(background.includes('#061018'), 'Android launcher background is not the Reach theme');
  assert(
    backgroundColor.includes('#061018'),
    'Android launcher adaptive color is not the Reach theme',
  );
}

async function main() {
  const packageJson = JSON.parse(await readFile(resolve('package.json'), 'utf8'));
  const expectedVersion = packageJson.version;
  assert(
    typeof expectedVersion === 'string' && expectedVersion.length > 0,
    'Package version is missing',
  );

  await verifyAndroidLauncherResources();

  await withDevPage('/reach-for-the-sky/?scenario=opening', async ({ url, devtools }) => {
    const metadata = await waitFor(
      'install metadata and previews',
      async () =>
        devtools.evaluate(`
(async () => {
  if (document.title !== 'Reach for the Sky') return null;
  const manifestLink = document.querySelector('link[rel="manifest"]')?.href ?? null;
  const iconLink = document.querySelector('link[rel="icon"]')?.href ?? null;
  const appleIcon = document.querySelector('link[rel="apple-touch-icon"]')?.href ?? null;
  const description = document.querySelector('meta[name="description"]')?.content ?? '';
  const appVersion = document.querySelector('meta[name="application-version"]')?.content ?? '';
  const releaseChannel = document.querySelector('meta[name="release-channel"]')?.content ?? '';
  const ogImage = document.querySelector('meta[property="og:image"]')?.content ?? '';
  const twitterImage = document.querySelector('meta[name="twitter:image"]')?.content ?? '';
  if (!manifestLink || !iconLink || !appleIcon || !description || !ogImage || !twitterImage) {
    return null;
  }

  const manifestResponse = await fetch(manifestLink, { cache: 'no-store' });
  if (!manifestResponse.ok) return null;
  if (!(manifestResponse.headers.get('content-type') ?? '').includes('manifest+json')) return null;
  const manifest = await manifestResponse.json();

  const resolveAsset = (source) => new URL(source, manifestLink).href;
  const loadImage = (source) => new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ source, width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve(null);
    image.src = resolveAsset(source) + '?metadata-check=' + Date.now();
  });
  const fetchAsset = async (source) => {
    const response = await fetch(resolveAsset(source), { cache: 'no-store' });
    if (!response.ok) return null;
    return { source, contentType: response.headers.get('content-type') ?? '', bytes: Number(response.headers.get('content-length') ?? 0) };
  };

  const screenshotImages = await Promise.all((manifest.screenshots ?? []).map((entry) => loadImage(entry.src)));
  const iconFetches = await Promise.all((manifest.icons ?? []).map((entry) => fetchAsset(entry.src)));

  return {
    title: document.title,
    manifestHref: manifestLink,
    iconHref: iconLink,
    appleIconHref: appleIcon,
    description,
    appVersion,
    releaseChannel,
    ogImage,
    twitterImage,
    manifest,
    screenshotImages,
    iconFetches,
  };
})()
`),
      30_000,
    );

    assert(metadata.title === 'Reach for the Sky', 'Document title is incorrect');
    assert(metadata.appVersion === expectedVersion, 'Application version meta tag is incorrect');
    assert(metadata.releaseChannel === 'production', 'Release channel meta tag is incorrect');
    assert(
      metadata.description.includes('modern living-tower simulator'),
      'Document description does not describe the game identity',
    );
    assert(metadata.manifest.name === 'Reach for the Sky', 'Manifest name is incorrect');
    assert(metadata.manifest.version === expectedVersion, 'Manifest version is incorrect');
    assert(metadata.manifest.display === 'standalone', 'Manifest display mode is not standalone');
    assert(metadata.manifest.theme_color === '#061018', 'Manifest theme color is incorrect');
    assert(
      metadata.manifest.categories?.includes('simulation') &&
        metadata.manifest.categories?.includes('strategy'),
      'Manifest categories are missing simulation/strategy',
    );

    const iconSources = new Set(metadata.manifest.icons?.map((entry) => entry.src) ?? []);
    for (const icon of requiredIcons) {
      assert(iconSources.has(icon), `Manifest missing icon: ${icon}`);
    }
    assert(
      metadata.manifest.icons?.some((entry) => entry.purpose === 'maskable'),
      'Manifest is missing a maskable icon',
    );
    assert(
      metadata.iconFetches.every((entry) => entry && entry.contentType.length > 0),
      'One or more manifest icons could not be fetched',
    );

    const screenshotSources = new Set(
      metadata.manifest.screenshots?.map((entry) => entry.src) ?? [],
    );
    for (const [source, expected] of expectedScreenshots) {
      assert(screenshotSources.has(source), `Manifest missing screenshot: ${source}`);
      const manifestEntry = metadata.manifest.screenshots.find((entry) => entry.src === source);
      assert(
        manifestEntry.form_factor === expected.formFactor,
        `Screenshot ${source} has wrong form factor`,
      );
      const image = metadata.screenshotImages.find((entry) => entry?.source === source);
      assert(image, `Screenshot ${source} could not be decoded`);
      assert(
        image.width === expected.width && image.height === expected.height,
        `Screenshot ${source} has ${image.width}x${image.height}, expected ${expected.width}x${expected.height}`,
      );
    }

    assert(
      metadata.ogImage.endsWith('/assets/previews/skyline-victory-desktop.png'),
      'OpenGraph image does not point at the skyline preview',
    );
    assert(
      metadata.twitterImage.endsWith('/assets/previews/skyline-victory-desktop.png'),
      'Twitter image does not point at the skyline preview',
    );

    process.stdout.write(
      `${JSON.stringify(
        {
          url,
          manifest: metadata.manifestHref,
          icons: [...iconSources],
          screenshots: [...screenshotSources],
        },
        null,
        2,
      )}\n`,
    );
  });
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
