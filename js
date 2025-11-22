// Code.gs

/**
 * Map of locationId -> sheetId or other info.
 * You can also put this in Script Properties if you prefer.
 */
const LOCATION_MAP = {
  "loc-a": "SHEET_ID_FOR_LOC_A",
  "loc-b": "SHEET_ID_FOR_LOC_B",
  // add all 7
};

function doGet(e) {
  const loc = (e.parameter.loc || "").toLowerCase();
  if (!loc || !LOCATION_MAP[loc]) {
    return jsonResponse({ error: "missing_or_unknown_loc" }, 400);
  }

  const sheetId = LOCATION_MAP[loc];
  const cfg = readConfigSheet(sheetId);
  cfg.locationId = loc;

  // Optionally attach non-secret runtime data (e.g., time)
  cfg.serverTimestamp = new Date().toISOString();

  // Do NOT attach secret keys here unless you intend the client to see them.
  // If you need to use a secret to fetch external data, do it server-side and attach only sanitized results.

  return jsonResponse(cfg);
}

/**
 * Fetch the sheet's config tab and return a key->value object.
 * Expects a sheet named "config" with headers in row 1 and values in row 2.
 */
function readConfigSheet(sheetId) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName("config");
    if (!sheet) return { error: "no_config_tab" };
    const values = sheet.getDataRange().getValues();
    if (!values || values.length < 2) return {};
    const headers = values[0].map(h => (h || "").toString().trim());
    const data = values[1];
    const obj = {};
    for (let i = 0; i < headers.length; i++) {
      if (!headers[i]) continue;
      obj[headers[i]] = data[i] === undefined ? "" : data[i];
    }
    return obj;
  } catch (err) {
    return { error: "read_error", detail: err.message };
  }
}

/**
 * Example server-side proxy to call an external API (keeps API key secret).
 * Client calls: /exec?loc=loc-a&proxy=something
 * This demonstrates fetching remote JSON and returning it to the client.
 */
function proxyExternalApi(loc, endpointKey, queryParams) {
  // endpointKey is a label you decide that maps to a URL template in script properties
  const props = PropertiesService.getScriptProperties();
  const urlTemplate = props.getProperty('ENDPOINT_' + endpointKey);
  const apiKey = props.getProperty('API_KEY_' + loc.toUpperCase()); // per-location secret
  if (!urlTemplate || !apiKey) return { error: "proxy_missing_config" };

  // substitute placeholders like {API_KEY} and others
  let url = urlTemplate.replace(/\{API_KEY\}/g, encodeURIComponent(apiKey));
  if (queryParams) {
    // append query string if needed
    url += (url.indexOf('?') === -1 ? '?' : '&') + queryParams;
  }

  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  return {
    status: response.getResponseCode(),
    body: response.getContentText()
  };
}

/* Helpers */
function jsonResponse(obj, code) {
  const output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  if (code) {
    // Apps Script doesn't let you set HTTP status code directly for doGet responses unless you use
    // HtmlService or advanced APIs; keep simple for now.
  }
  return output;
}
