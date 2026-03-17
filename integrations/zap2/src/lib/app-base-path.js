const normalizeBasePath = (value) => {
  if (!value || value === '/') {
    return '';
  }

  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash.replace(/\/+$/, '');
};

const appBasePath = normalizeBasePath(
  process.env.NEXT_PUBLIC_BASE_PATH ?? process.env.NEXT_PUBLIC_APP_BASE_PATH ?? '/zap2',
);

export const withAppBasePath = (path = '') => {
  if (!path) {
    return appBasePath || '/';
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${appBasePath}${normalizedPath}`;
};

export const getAppBasePath = () => appBasePath;
