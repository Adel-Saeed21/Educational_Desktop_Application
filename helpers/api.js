// api.js
const axios = require("axios");
const Store = require("electron-store").default;
const store = new Store();

function getToken() {
  return store.get("studentToken");
}

// ----------------------
// Generic GET Request
// ----------------------
async function apiGet(url, extraHeaders = {}, params = {}) {
  const token = getToken();
  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...extraHeaders,
      },
      params,
    });
    return { success: true, data: response.data };
  } catch (error) {
    console.error("GET Error:", error.message);
    return {
      success: false,
      message: error.response?.data?.detail || "GET request failed.",
    };
  }
}

// ----------------------
// Generic POST Request
// ----------------------
async function apiPost(url, data = {}, extraHeaders = {}) {
  const token = getToken();
  try {
    const response = await axios.post(url, data, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...extraHeaders,
      },
    });
    return { success: true, data: response.data };
  } catch (error) {
    console.error("POST Error:", error.message);
    return {
      success: false,
      message: error.response?.data?.detail || "POST request failed.",
    };
  }
}

module.exports = {
  apiGet,
  apiPost,
};
