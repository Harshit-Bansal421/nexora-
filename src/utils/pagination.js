const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

const parseInteger = (value) => {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) ? value : null;
  }
  if (typeof value !== "string" || !/^-?\d+$/.test(value.trim())) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

export const parsePagination = (query = {}) => {
  const parsedPage = parseInteger(query.page);
  const parsedLimit = parseInteger(query.limit);
  const page =
    parsedPage !== null && parsedPage >= 1 ? parsedPage : DEFAULT_PAGE;
  const limit =
    parsedLimit === null
      ? DEFAULT_LIMIT
      : Math.min(MAX_LIMIT, Math.max(1, parsedLimit));

  return { page, limit, skip: (page - 1) * limit };
};
